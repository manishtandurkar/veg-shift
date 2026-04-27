"""Step 9 - SHAP explainability for Random Forest baseline."""

from __future__ import annotations

import argparse
import json

import joblib
import numpy as np
import pandas as pd
import shap


FEATURES = [
    "temp_mean",
    "temp_max",
    "rainfall_annual",
    "wind_speed",
    "humidity",
    "n_dry_months",
    "monsoon_onset_doy",
    "sowing_window_miss",
    "gdd_accumulation",
    "crop_water_deficit",
    "pre_monsoon_depth_mbgl",
    "depletion_rate",
    "recharge_efficiency",
    "dual_deficit",
    "gdd_adequate",
    "gaez_baseline_class",
    "koppen_zone_enc",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate SHAP explanations for VegShift RF baseline (Step 9).")
    parser.add_argument("--input", default="data/processed/vegshift_master.csv")
    parser.add_argument("--rf-model", default="models/baselines/rf_baseline.pkl")
    parser.add_argument("--scaler", default="models/baselines/scaler.pkl")
    parser.add_argument("--output", default="data/output/shap_explanation.json")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    df = pd.read_csv(args.input)
    required_cols = FEATURES + ["city", "year"]
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing required columns in input data: {missing_cols}")

    df = df.copy()
    for col in FEATURES:
        df[col] = df.groupby("city")[col].transform(lambda x: x.fillna(x.mean()))
        if df[col].isna().any():
            df[col] = df[col].fillna(df[col].median())

    df = df.dropna(subset=["city", "year"])
    if df.empty:
        raise ValueError("No rows available for SHAP after city/year validation.")

    rf = joblib.load(args.rf_model)
    scaler = joblib.load(args.scaler)

    X_scaled = scaler.transform(df[FEATURES].to_numpy(dtype=float))
    explainer = shap.TreeExplainer(rf)
    shap_values = explainer.shap_values(X_scaled)

    if isinstance(shap_values, list):
        sv = np.asarray(shap_values[1]) if len(shap_values) > 1 else np.asarray(shap_values[0])
    else:
        sv = np.asarray(shap_values)
        if sv.ndim == 3:
            sv = sv[:, :, 1]

    if sv.ndim != 2:
        raise ValueError(f"Unexpected SHAP values shape: {sv.shape}")

    shap_df = pd.DataFrame(sv, columns=FEATURES)
    shap_df["city"] = df["city"].to_numpy()
    shap_df["year"] = df["year"].to_numpy()

    mean_abs = np.abs(sv).mean(axis=0)
    global_importance = pd.DataFrame(
        {"feature": FEATURES, "mean_abs_shap": mean_abs}
    ).sort_values("mean_abs_shap", ascending=False)

    city_importance: dict[str, dict[str, float]] = {}
    for city, city_df in shap_df.groupby("city", sort=True):
        city_values = np.abs(city_df[FEATURES].to_numpy()).mean(axis=0)
        city_top = (
            pd.Series(city_values, index=FEATURES)
            .sort_values(ascending=False)
            .head(5)
        )
        city_importance[city] = {k: float(v) for k, v in city_top.to_dict().items()}

    output = {
        "global_importance": [
            {"feature": str(row.feature), "mean_abs_shap": float(row.mean_abs_shap)}
            for row in global_importance.itertuples(index=False)
        ],
        "city_importance": city_importance,
    }

    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(output, handle, indent=2)

    print(f"SHAP explanation saved: {args.output}")
    print(f"Global features: {len(output['global_importance'])}")
    print(f"Cities explained: {len(output['city_importance'])}")


if __name__ == "__main__":
    main()