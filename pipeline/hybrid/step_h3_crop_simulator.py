"""
Step H3 — Physics-based crop growth simulation.

Implements a Python-native crop simulator combining:
  - FAO-56 Penman-Monteith evapotranspiration (Allen et al. 1998)
  - AquaCrop water productivity model (Steduto et al. 2009)
  - Growing Degree Day (GDD) phenology (McMaster & Wilhelm 1997)
  - FAO-33 yield response factor model (Doorenbos & Kassam 1979)
  - Simple soil water balance (Ritchie 1998)

This encodes real agricultural physics without requiring DSSAT installation.
It serves as the physics layer in the hybrid TFT→Physics→AI pipeline.

Outputs:
  data/output/hybrid/simulation_results.csv
"""

from __future__ import annotations

import argparse
import json
import pathlib
from dataclasses import dataclass

import numpy as np
import pandas as pd

try:
    from pipeline.hybrid.hybrid_shared import (
        CROP_DB, CropParams, SimulationResult,
        penman_monteith_eto_daily, save_results,
    )
except (ModuleNotFoundError, ImportError):
    from hybrid_shared import (
        CROP_DB, CropParams, SimulationResult,
        penman_monteith_eto_daily, save_results,
    )


# ---------------------------------------------------------------------------
# Soil water balance
# ---------------------------------------------------------------------------

@dataclass
class SoilProfile:
    fc: float = 0.30          # Field capacity (m³/m³)
    pwp: float = 0.12         # Permanent wilting point
    rew: float = 8.0          # Readily evaporable water (mm) — top 10 cm
    tew: float = 28.0         # Total evaporable water (mm)
    depth_m: float = 1.0      # Effective rooting zone depth (m)

    @property
    def taw(self) -> float:
        """Total available water (mm)."""
        return (self.fc - self.pwp) * self.depth_m * 1000

    @property
    def initial_sw(self) -> float:
        """Initial soil water at field capacity (mm)."""
        return self.fc * self.depth_m * 1000


# ---------------------------------------------------------------------------
# Core daily simulation loop
# ---------------------------------------------------------------------------

def _offset_to_sowing(arr: np.ndarray, sowing_month: int) -> np.ndarray:
    """Rotate daily array so it starts on the first day of sowing_month."""
    # Approximate DOY for start of each month (non-leap year)
    MONTH_START_DOY = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
    offset = MONTH_START_DOY[sowing_month - 1]
    return np.roll(arr, -offset)


def simulate_crop(
    crop: CropParams,
    daily_tmax: np.ndarray,
    daily_tmin: np.ndarray,
    daily_rain: np.ndarray,
    daily_srad: np.ndarray,
    daily_wind: np.ndarray,
    daily_rh: np.ndarray,
    soil: SoilProfile | None = None,
    irrigation_threshold: float = 0.5,  # Irrigate when depletion > 50% TAW
) -> SimulationResult:
    """
    Run the daily crop water balance and growth simulation.

    Returns a SimulationResult with yield, water, and phenology metrics.
    """
    if soil is None:
        soil = SoilProfile()

    # Rotate daily arrays so simulation starts at crop sowing month
    daily_tmax = _offset_to_sowing(daily_tmax, crop.sowing_month)
    daily_tmin = _offset_to_sowing(daily_tmin, crop.sowing_month)
    daily_rain = _offset_to_sowing(daily_rain, crop.sowing_month)
    daily_srad = _offset_to_sowing(daily_srad, crop.sowing_month)
    daily_wind = _offset_to_sowing(daily_wind, crop.sowing_month)
    daily_rh   = _offset_to_sowing(daily_rh, crop.sowing_month)

    # Only simulate for the crop's expected season length
    n_days = min(len(daily_tmax), crop.season_length_days + 30)
    daily_tmax = daily_tmax[:n_days]
    daily_tmin = daily_tmin[:n_days]
    daily_rain = daily_rain[:n_days]
    daily_srad = daily_srad[:n_days]
    daily_wind = daily_wind[:n_days]
    daily_rh   = daily_rh[:n_days]

    tmean = (daily_tmax + daily_tmin) / 2.0

    # ----- Phenology via Growing Degree Days -----
    gdd_daily = np.maximum(0.0, np.minimum(crop.t_max, tmean) - crop.t_base)
    gdd_cum = np.cumsum(gdd_daily)

    day_emergence = int(np.searchsorted(gdd_cum, crop.gdd_emergence))
    day_flowering = int(np.searchsorted(gdd_cum, crop.gdd_flowering))
    day_maturity = int(np.searchsorted(gdd_cum, crop.gdd_maturity))
    season_complete = day_maturity < n_days

    if not season_complete:
        day_maturity = n_days - 1

    # ----- Stress day counters -----
    heat_stress_days = int(np.sum(daily_tmax > crop.t_max))
    frost_stress_days = int(np.sum(daily_tmin < crop.t_base - 2))

    # ----- Crop coefficient (Kc) by growth stage -----
    kc = np.full(n_days, crop.kc_initial)
    if day_emergence < day_flowering:
        # Linear ramp initial→mid
        ramp = np.linspace(crop.kc_initial, crop.kc_mid,
                           day_flowering - day_emergence)
        kc[day_emergence:day_flowering] = ramp
    kc[day_flowering:day_maturity] = crop.kc_mid
    if day_maturity < n_days:
        kc[day_maturity:] = crop.kc_late

    # ----- Daily ETo (FAO-56 Penman-Monteith) -----
    altitude = 300.0
    eto = np.array([
        penman_monteith_eto_daily(
            daily_tmax[i], daily_tmin[i], tmean[i],
            daily_srad[i], daily_rh[i], daily_wind[i], altitude,
        )
        for i in range(n_days)
    ])

    # ----- Soil water balance -----
    sw = soil.initial_sw
    total_drainage = 0.0
    total_runoff = 0.0
    total_irrigation = 0.0
    irrigation_days = 0
    water_stress_days = 0
    etcrop_actual_total = 0.0

    etcrop_potential = np.zeros(n_days)
    ks = np.ones(n_days)  # Water stress coefficient

    for i in range(n_days):
        etc_pot = kc[i] * eto[i]
        etcrop_potential[i] = etc_pot

        # Compute water stress coefficient (FAO-56 Eq 84)
        taw = soil.taw
        raw = 0.5 * taw  # Readily available water (p=0.5)
        depletion = soil.initial_sw - sw
        if depletion > raw:
            ks_i = max(0.0, (taw - depletion) / (taw - raw + 1e-6))
        else:
            ks_i = 1.0
        ks[i] = ks_i

        if ks_i < 0.9 and i >= day_emergence and i <= day_maturity:
            water_stress_days += 1

        # Actual ET
        etc_actual = ks_i * etc_pot
        etcrop_actual_total += etc_actual

        # Irrigation decision (if below threshold and growing season)
        if (depletion > irrigation_threshold * taw and
                i >= day_emergence and i <= day_maturity):
            irr = depletion - irrigation_threshold * taw
            sw = min(sw + irr, soil.initial_sw)
            total_irrigation += irr
            irrigation_days += 1

        # Update soil water
        sw = sw + daily_rain[i] - etc_actual
        excess = max(0.0, sw - soil.initial_sw)
        total_drainage += excess
        sw = min(sw, soil.initial_sw)
        runoff = max(0.0, daily_rain[i] - 0.2 * soil.taw) if daily_rain[i] > 10 else 0.0
        total_runoff += runoff
        sw = max(sw, soil.pwp * soil.depth_m * 1000 * 0.5)

    # ----- Yield estimation (FAO-33 + observed WP approach) -----
    # WP is in kg grain/ha per mm ETcrop (empirically observed, IRRI/ICRISAT)
    # potential_yield = WP × ETcrop_potential / 1000  (t/ha)
    etx = etcrop_potential[day_emergence:day_maturity + 1].sum()  # mm
    eta = etcrop_actual_total  # mm

    potential_yield = crop.water_productivity * etx / 1000.0  # t/ha

    # FAO-33 yield response: 1 - Ya/Yx = Ky × (1 - ETa/ETx)
    if etx > 0 and potential_yield > 0:
        ya_yx_ratio = max(0.0, 1.0 - crop.ky * (1.0 - eta / etx))
    else:
        ya_yx_ratio = 0.0

    actual_yield = potential_yield * ya_yx_ratio

    # Heat stress penalty (non-linear: first 10 days tolerated, then 1.5%/day)
    # Bounded to minimum 0.1 so yield never collapses to absolute zero from heat alone
    excess_heat = max(0, heat_stress_days - 10)
    heat_penalty = max(0.1, 1.0 - 0.015 * excess_heat)
    actual_yield *= heat_penalty
    potential_yield *= max(0.1, 1.0 - 0.005 * excess_heat)

    # Phenology penalty — incomplete season gives partial yield
    if not season_complete:
        actual_yield *= 0.5

    yield_gap_pct = (
        (potential_yield - actual_yield) / potential_yield * 100.0
        if potential_yield > 0 else 0.0
    )

    return SimulationResult(
        city="", crop=crop.name, year=0, scenario="",
        simulated_yield_t_ha=round(max(0.0, actual_yield), 3),
        potential_yield_t_ha=round(max(0.0, potential_yield), 3),
        yield_gap_pct=round(yield_gap_pct, 1),
        eto_mm=round(float(eto.sum()), 1),
        etcrop_mm=round(etcrop_actual_total, 1),
        irrigation_demand_mm=round(total_irrigation, 1),
        water_stress_days=water_stress_days,
        gdd_total=round(float(gdd_cum[-1]), 1),
        heat_stress_days=heat_stress_days,
        frost_stress_days=frost_stress_days,
        season_complete=season_complete,
        drainage_mm=round(total_drainage, 1),
        runoff_mm=round(total_runoff, 1),
    )


# ---------------------------------------------------------------------------
# Weather file reader
# ---------------------------------------------------------------------------

def read_wth_file(wth_path: pathlib.Path) -> pd.DataFrame:
    """Parse a DSSAT .WTH file into a daily DataFrame."""
    rows = []
    in_data = False
    with open(wth_path) as f:
        for line in f:
            line = line.strip()
            if line.startswith("@DATE"):
                in_data = True
                continue
            if in_data and line and not line.startswith("*") and not line.startswith("!"):
                parts = line.split()
                if len(parts) >= 5:
                    try:
                        rows.append({
                            "srad": float(parts[1]),
                            "tmax": float(parts[2]),
                            "tmin": float(parts[3]),
                            "rain": float(parts[4]),
                            "wind": float(parts[6]) / 86.4 if len(parts) > 6 else 2.0,
                        })
                    except (ValueError, IndexError):
                        continue
    return pd.DataFrame(rows)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="H3 — Physics crop simulation.")
    p.add_argument("--wth-dir", default="data/output/hybrid/dssat_weather")
    p.add_argument("--forecasts", default="data/output/hybrid/climate_forecasts.csv")
    p.add_argument("--output-dir", default="data/output/hybrid")
    p.add_argument(
        "--crops", nargs="+",
        default=["rice", "wheat", "maize", "millet"],
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()
    out_dir = pathlib.Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    wth_dir = pathlib.Path(args.wth_dir)

    manifest_path = wth_dir / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"WTH manifest not found: {manifest_path}. Run step_h2 first.")

    with open(manifest_path) as fh:
        manifest = json.load(fh)

    forecast_df = pd.read_csv(args.forecasts)
    # humidity lookup: city × year × scenario
    hum_lookup = forecast_df.set_index(["city", "year", "scenario"])["humidity"].to_dict() \
        if "humidity" in forecast_df.columns else {}

    crops_to_sim = [CROP_DB[c] for c in args.crops if c in CROP_DB]
    print(f"Simulating {len(crops_to_sim)} crops × {len(manifest)} climate files")

    results: list[SimulationResult] = []
    total = len(manifest) * len(crops_to_sim)
    done = 0

    for entry in manifest:
        city = entry["city"]
        scenario = entry["scenario"]
        year = entry["year"]
        wth_path = wth_dir / entry["wth_file"]

        if not wth_path.exists():
            continue

        daily = read_wth_file(wth_path)
        if daily.empty or len(daily) < 90:
            continue

        # Humidity: use forecast lookup or default
        hum = hum_lookup.get((city, year, scenario), 60.0)
        daily_rh = np.full(len(daily), float(hum))

        for crop in crops_to_sim:
            result = simulate_crop(
                crop,
                daily["tmax"].to_numpy(),
                daily["tmin"].to_numpy(),
                daily["rain"].to_numpy(),
                daily["srad"].to_numpy(),
                daily["wind"].to_numpy(),
                daily_rh,
            )
            result.city = city
            result.year = year
            result.scenario = scenario
            results.append(result)

            done += 1
            if done % 50 == 0:
                print(f"  {done}/{total} simulations complete")

    out_path = out_dir / "simulation_results.csv"
    save_results(results, out_path)
    print(f"\nSimulation complete: {len(results)} runs saved to {out_path}")

    # Quick summary
    result_df = pd.DataFrame([r.to_dict() for r in results])
    print("\nMean yield by crop and scenario:")
    print(
        result_df.groupby(["crop", "scenario"])["simulated_yield_t_ha"]
        .mean().round(3).unstack().to_string()
    )
    print("\nMean irrigation demand (mm) by scenario:")
    print(
        result_df.groupby(["scenario"])["irrigation_demand_mm"]
        .mean().round(1).to_string()
    )


if __name__ == "__main__":
    main()
