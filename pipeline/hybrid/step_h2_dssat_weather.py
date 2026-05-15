"""
Step H2 — Generate DSSAT-format weather files (.WTH) from climate forecasts.

DSSAT .WTH format reference: DSSAT v4.8 documentation, Section 3.2
Each .WTH file covers one city × one scenario × one decade.

Outputs:
  data/output/hybrid/dssat_weather/<CITY>_<SCENARIO>_<DECADE>.WTH
  data/output/hybrid/dssat_weather/manifest.json
"""

from __future__ import annotations

import argparse
import json
import math
import pathlib
from datetime import date, timedelta

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# City metadata (lat/lon/altitude for solar radiation estimation)
# ---------------------------------------------------------------------------

CITY_META: dict[str, dict] = {
    "Delhi":     {"lat": 28.6, "lon": 77.2, "alt": 216},
    "Mumbai":    {"lat": 19.1, "lon": 72.9, "alt": 14},
    "Chennai":   {"lat": 13.1, "lon": 80.3, "alt": 6},
    "Kolkata":   {"lat": 22.6, "lon": 88.4, "alt": 6},
    "Bangalore": {"lat": 12.9, "lon": 77.6, "alt": 920},
    "Hyderabad": {"lat": 17.4, "lon": 78.5, "alt": 536},
    "Lucknow":   {"lat": 26.8, "lon": 80.9, "alt": 111},
    "Jaipur":    {"lat": 26.9, "lon": 75.8, "alt": 431},
    "Nagpur":    {"lat": 21.1, "lon": 79.1, "alt": 310},
    "Jodhpur":   {"lat": 26.3, "lon": 73.0, "alt": 224},
    "Ahmedabad": {"lat": 23.0, "lon": 72.6, "alt": 53},
    "Pune":      {"lat": 18.5, "lon": 73.9, "alt": 559},
    "Patna":     {"lat": 25.6, "lon": 85.1, "alt": 53},
    "Bhopal":    {"lat": 23.3, "lon": 77.4, "alt": 523},
    "Coimbatore":{"lat": 11.0, "lon": 77.0, "alt": 411},
}

DEFAULT_META = {"lat": 20.0, "lon": 78.0, "alt": 300}


def estimate_solar_radiation(lat_deg: float, doy: int) -> float:
    """
    Estimate daily solar radiation (MJ/m²/day) using Angstrom-Prescott method.
    Assumes mean cloud fraction = 0.5 for India.
    """
    lat = math.radians(lat_deg)
    dr = 1 + 0.033 * math.cos(2 * math.pi * doy / 365)
    decl = 0.409 * math.sin(2 * math.pi * doy / 365 - 1.39)
    ws = math.acos(-math.tan(lat) * math.tan(decl))
    ra = (24 / math.pi) * 4.92 * dr * (
        ws * math.sin(lat) * math.sin(decl) +
        math.cos(lat) * math.cos(decl) * math.sin(ws)
    )
    # Angstrom-Prescott: Rs = (0.25 + 0.5 * n/N) * Ra, n/N = 0.5 assumed
    rs = max(1.0, 0.50 * ra)
    return round(rs, 2)


def disaggregate_annual_to_daily(
    row: pd.Series,
    year: int,
    lat: float,
    lon: float,
) -> pd.DataFrame:
    """
    Disaggregate annual/seasonal climate statistics to daily values using
    monthly climatological profiles for the Indian subcontinent.
    """
    # Monthly multipliers relative to annual mean (derived from IMD climatology)
    # Indices 0-11 = Jan-Dec
    # TMAX offsets calibrated so Jan~21°C, May~41°C relative to ~33°C annual mean
    MONTHLY_PRECIP_PROFILE = [0.02, 0.02, 0.02, 0.02, 0.03, 0.10,
                               0.22, 0.24, 0.16, 0.08, 0.05, 0.04]
    MONTHLY_TMAX_OFFSET = [-12, -9, -2, +5, +8, +6, +2, +1, +1, +1, -4, -9]
    MONTHLY_TMIN_OFFSET = [-8, -7, -4, -1, +2, +3, +3, +2, +1, -1, -5, -8]

    annual_rain = float(row.get("rainfall_annual", 800))
    temp_mean = float(row.get("temp_mean", 25))
    temp_max_ann = float(row.get("temp_max", temp_mean + 6))
    humidity = float(row.get("humidity", 60))
    wind = float(row.get("wind_speed", 2.0))

    records = []
    start = date(year, 1, 1)
    days_in_year = 366 if (year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)) else 365

    for doy in range(1, days_in_year + 1):
        d = start + timedelta(days=doy - 1)
        m = d.month - 1  # 0-indexed

        precip = (MONTHLY_PRECIP_PROFILE[m] * annual_rain) / (30 if m != 1 else 28)
        # Add stochastic variability (reproducible via city+year seed)
        rng = np.random.default_rng(seed=hash(f"{row.get('city','X')}{year}{doy}") % (2**32))
        if rng.random() > 0.3:
            precip = 0.0
        else:
            precip = precip * rng.exponential(1.0) * 3

        tmax = temp_max_ann + MONTHLY_TMAX_OFFSET[m]
        tmin = tmax - 8 + MONTHLY_TMIN_OFFSET[m]
        tmax += rng.normal(0, 1.5)
        tmin += rng.normal(0, 1.0)
        tmin = min(tmin, tmax - 2)

        rs = estimate_solar_radiation(lat, doy)

        records.append({
            "date": d.strftime("%Y%j"),   # DSSAT format YYYYDDD
            "srad": round(rs, 1),
            "tmax": round(tmax, 1),
            "tmin": round(tmin, 1),
            "rain": round(max(0, precip), 1),
            "dewp": round(tmin - 2, 1),   # dewpoint ≈ tmin - 2
            "wind": round(wind * 86.4, 1), # m/s → km/day
        })

    return pd.DataFrame(records)


def write_wth_file(
    daily_df: pd.DataFrame,
    city: str,
    meta: dict,
    scenario: str,
    year: int,
    out_dir: pathlib.Path,
) -> pathlib.Path:
    """Write a DSSAT-format .WTH file."""
    city_code = city[:4].upper()
    filename = f"{city_code}_{scenario}_{year}.WTH"
    out_path = out_dir / filename

    with open(out_path, "w") as f:
        f.write(f"*WEATHER DATA : {city} — {scenario} scenario, year {year}\n")
        f.write(f"\n@ INSI      LAT     LONG  ELEV   TAV   AMP REFHT WNDHT\n")
        tav = daily_df["tmax"].mean() - 3
        amp = (daily_df["tmax"].max() - daily_df["tmax"].min()) / 2
        f.write(
            f"  {city_code:<6} {meta['lat']:7.3f} {meta['lon']:7.3f}"
            f"  {meta['alt']:4.0f}  {tav:5.1f}  {amp:5.1f}   2.0   2.0\n"
        )
        f.write("\n@DATE  SRAD  TMAX  TMIN  RAIN  DEWP  WIND\n")
        for _, row in daily_df.iterrows():
            f.write(
                f"{row['date']} {row['srad']:5.1f} {row['tmax']:5.1f}"
                f" {row['tmin']:5.1f} {row['rain']:5.1f}"
                f" {row['dewp']:5.1f} {row['wind']:6.1f}\n"
            )
    return out_path


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="H2 — Generate DSSAT weather files.")
    p.add_argument("--forecasts", default="data/output/hybrid/climate_forecasts.csv")
    p.add_argument("--output-dir", default="data/output/hybrid/dssat_weather")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    out_dir = pathlib.Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(args.forecasts)
    forecast_df = df[df["scenario"] != "historical"].copy()
    print(f"Generating WTH files for {forecast_df['city'].nunique()} cities × "
          f"{forecast_df['scenario'].nunique()} scenarios × {forecast_df['year'].nunique()} years")

    manifest: list[dict] = []

    for _, row in forecast_df.iterrows():
        city = str(row["city"])
        scenario = str(row["scenario"])
        year = int(row["year"])
        meta = CITY_META.get(city, DEFAULT_META)

        daily = disaggregate_annual_to_daily(row, year, meta["lat"], meta["lon"])
        wth_path = write_wth_file(daily, city, meta, scenario, year, out_dir)

        manifest.append({
            "city": city,
            "scenario": scenario,
            "year": year,
            "wth_file": wth_path.name,
            "annual_rain_mm": round(daily["rain"].sum(), 1),
            "mean_tmax": round(daily["tmax"].mean(), 2),
            "mean_tmin": round(daily["tmin"].mean(), 2),
        })

    with open(out_dir / "manifest.json", "w") as fh:
        json.dump(manifest, fh, indent=2)

    print(f"Generated {len(manifest)} .WTH files -> {out_dir}")
    print(f"Manifest: {out_dir / 'manifest.json'}")


if __name__ == "__main__":
    main()
