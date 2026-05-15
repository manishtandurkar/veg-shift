"""Shared constants, data classes, and utilities for the VegShift hybrid pipeline."""

from __future__ import annotations

import json
import pathlib
from dataclasses import dataclass, asdict, field
from typing import Optional

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Crop physical parameters (FAO-56 / DSSAT / AquaCrop standard values)
# ---------------------------------------------------------------------------

@dataclass
class CropParams:
    name: str
    gdd_emergence: float        # GDD to emergence (°C·days)
    gdd_flowering: float        # GDD to flowering
    gdd_maturity: float         # GDD to physiological maturity
    t_base: float               # Base temperature (°C)
    t_opt: float                # Optimum temperature (°C)
    t_max: float                # Max temperature (ceiling, °C)
    kc_initial: float           # Crop coefficient — initial stage
    kc_mid: float               # Crop coefficient — mid stage
    kc_late: float              # Crop coefficient — late stage
    ky: float                   # Yield response factor (FAO-33)
    water_productivity: float   # WP* (kg/ha/mm ETcrop) — grain yield per unit ET
    harvest_index: float        # HI — grain/biomass ratio (used for stress penalty scaling)
    max_lai: float              # Maximum leaf area index
    rooting_depth: float        # Maximum rooting depth (m)
    sowing_month: int           # Typical sowing month (1-12)
    season_length_days: int     # Approximate growing season (days)


CROP_DB: dict[str, CropParams] = {
    # water_productivity in kg grain/ha per mm ETcrop (observed values from ICRISAT/IRRI)
    "rice": CropParams(
        name="rice",
        gdd_emergence=100, gdd_flowering=900, gdd_maturity=1500,
        t_base=10, t_opt=28, t_max=40,
        kc_initial=1.05, kc_mid=1.20, kc_late=0.90,
        ky=1.09, water_productivity=14.0, harvest_index=0.45,
        max_lai=4.5, rooting_depth=0.5,
        sowing_month=6, season_length_days=120,
    ),
    "wheat": CropParams(
        name="wheat",
        gdd_emergence=80, gdd_flowering=700, gdd_maturity=1200,
        t_base=0, t_opt=15, t_max=30,
        kc_initial=0.40, kc_mid=1.15, kc_late=0.30,
        ky=1.00, water_productivity=18.0, harvest_index=0.42,
        max_lai=4.0, rooting_depth=1.0,
        sowing_month=11, season_length_days=120,
    ),
    "maize": CropParams(
        name="maize",
        gdd_emergence=90, gdd_flowering=800, gdd_maturity=1400,
        t_base=8, t_opt=25, t_max=38,
        kc_initial=0.30, kc_mid=1.20, kc_late=0.50,
        ky=1.25, water_productivity=20.0, harvest_index=0.48,
        max_lai=5.0, rooting_depth=1.2,
        sowing_month=6, season_length_days=110,
    ),
    "millet": CropParams(
        name="millet",
        gdd_emergence=80, gdd_flowering=750, gdd_maturity=1100,
        t_base=10, t_opt=32, t_max=42,
        kc_initial=0.30, kc_mid=1.00, kc_late=0.40,
        ky=0.80, water_productivity=10.0, harvest_index=0.35,
        max_lai=3.5, rooting_depth=0.9,
        sowing_month=6, season_length_days=90,
    ),
    "sugarcane": CropParams(
        name="sugarcane",
        gdd_emergence=150, gdd_flowering=2500, gdd_maturity=4500,
        t_base=15, t_opt=30, t_max=38,
        kc_initial=0.40, kc_mid=1.25, kc_late=0.75,
        ky=1.20, water_productivity=8.0, harvest_index=0.72,
        max_lai=6.0, rooting_depth=1.5,
        sowing_month=2, season_length_days=360,
    ),
}


# ---------------------------------------------------------------------------
# Climate scenario parameters (SSP radiative forcing levels)
# ---------------------------------------------------------------------------

SSP_SCENARIOS = {
    "SSP126": {"warming_by_2050": 1.5, "precip_change": 0.05},
    "SSP245": {"warming_by_2050": 2.0, "precip_change": 0.02},
    "SSP585": {"warming_by_2050": 4.0, "precip_change": -0.05},
}


# ---------------------------------------------------------------------------
# Simulation result dataclass
# ---------------------------------------------------------------------------

@dataclass
class SimulationResult:
    city: str
    crop: str
    year: int
    scenario: str

    # Yield metrics
    simulated_yield_t_ha: float
    potential_yield_t_ha: float
    yield_gap_pct: float

    # Water metrics
    eto_mm: float                   # Reference evapotranspiration
    etcrop_mm: float                # Actual crop ET
    irrigation_demand_mm: float
    water_stress_days: int

    # Phenology metrics
    gdd_total: float
    heat_stress_days: int
    frost_stress_days: int
    season_complete: bool           # Did crop reach maturity?

    # Soil metrics
    drainage_mm: float
    runoff_mm: float

    def to_dict(self) -> dict:
        return asdict(self)


# ---------------------------------------------------------------------------
# Utility functions
# ---------------------------------------------------------------------------

def load_master(path: str | pathlib.Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    df = df.sort_values(["city", "year"]).reset_index(drop=True)
    return df


def save_results(results: list[SimulationResult], out_path: pathlib.Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame([r.to_dict() for r in results]).to_csv(out_path, index=False)


def monthly_to_daily(monthly_vals: list[float], days_in_months: list[int]) -> np.ndarray:
    """Expand monthly climate values to a daily array by uniform distribution within each month."""
    daily = []
    for val, days in zip(monthly_vals, days_in_months):
        daily.extend([val] * days)
    return np.array(daily, dtype=float)


def penman_monteith_eto_daily(
    tmax: float, tmin: float, tmean: float,
    rs_mj: float, rh_mean: float, wind_ms: float,
    altitude_m: float = 250.0,
) -> float:
    """
    FAO-56 Penman-Monteith reference ETo (mm/day).
    rs_mj: solar radiation MJ/m²/day
    """
    P = 101.3 * ((293 - 0.0065 * altitude_m) / 293) ** 5.26  # kPa
    gamma = 0.000665 * P

    delta = 4098 * (0.6108 * np.exp(17.27 * tmean / (tmean + 237.3))) / (tmean + 237.3) ** 2

    es = (0.6108 * np.exp(17.27 * tmax / (tmax + 237.3)) +
          0.6108 * np.exp(17.27 * tmin / (tmin + 237.3))) / 2
    ea = es * (rh_mean / 100.0)
    vpd = es - ea

    rns = (1 - 0.23) * rs_mj
    rn = rns - 0.5  # simplified net longwave radiation

    numerator = 0.408 * delta * rn + gamma * (900 / (tmean + 273)) * wind_ms * vpd
    denominator = delta + gamma * (1 + 0.34 * wind_ms)

    eto = max(0.0, numerator / denominator)
    return float(eto)
