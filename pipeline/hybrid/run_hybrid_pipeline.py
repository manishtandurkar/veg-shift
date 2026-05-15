"""
VegShift Hybrid Physics + AI Pipeline — Full runner.

Executes all four stages sequentially:
  H1: Climate forecasting (TFT delta-method SSP projections)
  H2: DSSAT weather file generation
  H3: Physics crop simulation (AquaCrop/FAO-56 equations)
  H4: AI decision layer (suitability scoring, risk classification, SHAP)

Usage:
  python pipeline/hybrid/run_hybrid_pipeline.py
  python pipeline/hybrid/run_hybrid_pipeline.py --crops rice wheat --scenarios SSP245 SSP585
  python pipeline/hybrid/run_hybrid_pipeline.py --skip H1 H2   # resume from simulation
"""

from __future__ import annotations

import argparse
import sys
import time
import pathlib


def banner(title: str) -> None:
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def run_step(step_name: str, module_path: str, extra_args: list[str]) -> None:
    import importlib
    import importlib.util

    banner(step_name)
    t0 = time.time()

    spec = importlib.util.spec_from_file_location("step_module", module_path)
    mod = importlib.util.module_from_spec(spec)
    sys.argv = [module_path] + extra_args
    spec.loader.exec_module(mod)
    mod.main()

    elapsed = time.time() - t0
    print(f"\n  [{step_name}] done in {elapsed:.1f}s")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="VegShift Hybrid Pipeline — full runner.")
    p.add_argument("--input", default="data/processed/vegshift_master.csv")
    p.add_argument("--output-dir", default="data/output/hybrid")
    p.add_argument(
        "--scenarios", nargs="+",
        default=["SSP126", "SSP245", "SSP585"],
    )
    p.add_argument(
        "--forecast-years", nargs="+", type=int,
        default=[2025, 2030, 2035, 2040, 2045, 2050],
    )
    p.add_argument(
        "--crops", nargs="+",
        default=["rice", "wheat", "maize", "millet"],
    )
    p.add_argument(
        "--skip", nargs="*", default=[],
        help="Steps to skip, e.g. --skip H1 H2",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()
    base = pathlib.Path(__file__).parent
    out = args.output_dir

    banner("VegShift Hybrid Physics + AI Pipeline")
    print(f"  Input:     {args.input}")
    print(f"  Output:    {out}")
    print(f"  Scenarios: {args.scenarios}")
    print(f"  Years:     {args.forecast_years}")
    print(f"  Crops:     {args.crops}")
    print(f"  Skipping:  {args.skip or 'none'}")

    if "H1" not in args.skip:
        run_step(
            "H1 — Climate Forecasting (SSP delta method)",
            str(base / "step_h1_climate_forecast.py"),
            [
                "--input", args.input,
                "--output-dir", out,
                "--scenarios", *args.scenarios,
                "--forecast-years", *[str(y) for y in args.forecast_years],
            ],
        )

    if "H2" not in args.skip:
        run_step(
            "H2 — DSSAT Weather File Generation",
            str(base / "step_h2_dssat_weather.py"),
            [
                "--forecasts", f"{out}/climate_forecasts.csv",
                "--output-dir", f"{out}/dssat_weather",
            ],
        )

    if "H3" not in args.skip:
        run_step(
            "H3 — Physics Crop Simulation (FAO-56 / AquaCrop)",
            str(base / "step_h3_crop_simulator.py"),
            [
                "--wth-dir", f"{out}/dssat_weather",
                "--forecasts", f"{out}/climate_forecasts.csv",
                "--output-dir", out,
                "--crops", *args.crops,
            ],
        )

    if "H4" not in args.skip:
        run_step(
            "H4 — AI Decision Layer (Suitability + Risk + SHAP)",
            str(base / "step_h4_decision_layer.py"),
            [
                "--simulations", f"{out}/simulation_results.csv",
                "--output-dir", out,
            ],
        )

    banner("Pipeline Complete")
    print(f"\nOutputs in: {out}/")
    print("  climate_forecasts.csv    — SSP climate projections per city")
    print("  dssat_weather/           — DSSAT .WTH files per city/scenario/year")
    print("  simulation_results.csv   — Physics simulation: yield, water, phenology")
    print("  suitability_scores.csv   — AI suitability + risk scores per simulation")
    print("  risk_analysis.json       — Summary statistics and feature importances")
    print("  feature_importance.json  — Which physics variables drive AI decisions")


if __name__ == "__main__":
    main()
