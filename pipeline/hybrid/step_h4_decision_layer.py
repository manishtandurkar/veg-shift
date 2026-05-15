"""
Step H4 — AI decision layer: crop suitability scoring and risk classification.

Trains a gradient-boosted classifier on the physics simulation outputs
(yield gap, water stress, heat stress, irrigation demand) to produce:
  - Suitability score (0–1)
  - Risk level (Low / Medium / High / Critical)
  - Adaptation recommendations

This is the "AI interprets physics" layer in the hybrid pipeline.

Inputs:
  data/output/hybrid/simulation_results.csv

Outputs:
  data/output/hybrid/suitability_scores.csv
  data/output/hybrid/risk_analysis.json
  data/output/hybrid/feature_importance.json
"""

from __future__ import annotations

import argparse
import json
import pathlib

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score

try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False


# ---------------------------------------------------------------------------
# Rule-based suitability labeling (physics-grounded ground truth)
# ---------------------------------------------------------------------------

def compute_suitability_label(row: pd.Series) -> int:
    """
    Derive suitability class from simulation physics:
      0 = Unsuitable, 1 = Marginal, 2 = Suitable, 3 = Optimal

    Based on FAO agro-ecological zone criteria and AquaCrop thresholds.
    """
    yield_ratio = row["simulated_yield_t_ha"] / max(0.01, row["potential_yield_t_ha"])
    water_stress = row["water_stress_days"]
    heat_stress = row["heat_stress_days"]
    season_complete = bool(row["season_complete"])
    yield_gap = row["yield_gap_pct"]

    if not season_complete or yield_ratio < 0.25 or heat_stress > 45:
        return 0  # Unsuitable
    elif yield_ratio < 0.50 or water_stress > 40 or heat_stress > 30:
        return 1  # Marginal
    elif yield_ratio < 0.75 or water_stress > 20 or yield_gap > 35:
        return 2  # Suitable
    else:
        return 3  # Optimal


def compute_suitability_score(row: pd.Series) -> float:
    """Continuous suitability score 0–1 from physics outputs."""
    yield_ratio = row["simulated_yield_t_ha"] / max(0.01, row["potential_yield_t_ha"])
    season_bonus = 1.0 if row["season_complete"] else 0.6
    heat_penalty = max(0.0, 1 - 0.015 * row["heat_stress_days"])
    water_penalty = max(0.0, 1 - 0.01 * row["water_stress_days"])
    return float(np.clip(yield_ratio * season_bonus * heat_penalty * water_penalty, 0, 1))


# ---------------------------------------------------------------------------
# Risk classifier features
# ---------------------------------------------------------------------------

FEATURE_COLS = [
    "simulated_yield_t_ha",
    "potential_yield_t_ha",
    "yield_gap_pct",
    "eto_mm",
    "etcrop_mm",
    "irrigation_demand_mm",
    "water_stress_days",
    "gdd_total",
    "heat_stress_days",
    "frost_stress_days",
    "drainage_mm",
    "runoff_mm",
]

RISK_LABELS = {0: "Optimal", 1: "Low", 2: "Medium", 3: "High", 4: "Critical"}


def classify_risk(row: pd.Series) -> int:
    """
    Physics-rule risk tier:
      0 = Optimal, 1 = Low, 2 = Medium, 3 = High, 4 = Critical
    """
    heat = row["heat_stress_days"]
    water = row["water_stress_days"]
    yield_gap = row["yield_gap_pct"]
    complete = bool(row["season_complete"])

    if not complete or heat > 60 or water > 60:
        return 4  # Critical
    elif heat > 40 or water > 45 or yield_gap > 55:
        return 3  # High
    elif heat > 20 or water > 25 or yield_gap > 35:
        return 2  # Medium
    elif heat > 10 or water > 10 or yield_gap > 15:
        return 1  # Low
    else:
        return 0  # Optimal


# ---------------------------------------------------------------------------
# Adaptation recommendations
# ---------------------------------------------------------------------------

def generate_adaptation(row: pd.Series) -> str:
    """Generate rule-based adaptation recommendation from simulation outputs."""
    recs = []

    if row["heat_stress_days"] > 30:
        recs.append("shift sowing date 2–3 weeks earlier to avoid peak heat")
    if row["heat_stress_days"] > 50:
        recs.append("switch to heat-tolerant variety (e.g. DRR Dhan 42 for rice)")
    if row["irrigation_demand_mm"] > 400:
        recs.append("adopt micro-drip irrigation to reduce water demand by 30–40%")
    if row["water_stress_days"] > 30:
        recs.append("apply mulching to reduce soil evaporation")
    if row["yield_gap_pct"] > 40:
        recs.append("precision nutrient management can close yield gap significantly")
    if row["drainage_mm"] > 200:
        recs.append("improved soil drainage management needed (raised beds, sub-surface drains)")
    if not row["season_complete"]:
        recs.append("crop does not reach maturity under this scenario — consider alternative crops")

    if not recs:
        recs.append("current crop-climate combination is sustainable — maintain existing practices")

    return "; ".join(recs)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="H4 — AI decision layer.")
    p.add_argument("--simulations", default="data/output/hybrid/simulation_results.csv")
    p.add_argument("--output-dir", default="data/output/hybrid")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    out_dir = pathlib.Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(args.simulations)
    print(f"Loaded {len(df)} simulation results.")

    # Compute physics-grounded labels
    df["suitability_class"] = df.apply(compute_suitability_label, axis=1)
    df["suitability_score"] = df.apply(compute_suitability_score, axis=1).round(3)
    df["risk_class"] = df.apply(classify_risk, axis=1)
    df["risk_label"] = df["risk_class"].map(RISK_LABELS)
    df["adaptation"] = df.apply(generate_adaptation, axis=1)

    # ----- Train AI classifier on physics-derived labels -----
    available_features = [c for c in FEATURE_COLS if c in df.columns]
    X = df[available_features].fillna(0).to_numpy(dtype=float)
    y = df["suitability_class"].to_numpy(dtype=int)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    clf = GradientBoostingClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        random_state=42,
    )
    clf.fit(X_scaled, y)

    # Cross-validate
    cv_scores = cross_val_score(clf, X_scaled, y, cv=5, scoring="f1_macro")
    print(f"AI classifier F1-macro CV: {cv_scores.mean():.3f} ± {cv_scores.std():.3f}")

    # AI-predicted suitability score (probability of class 2 + class 3)
    proba = clf.predict_proba(X_scaled)
    n_classes = proba.shape[1]
    if n_classes >= 4:
        df["ai_suitability_score"] = (proba[:, 2] + proba[:, 3]).round(3)
    elif n_classes >= 3:
        df["ai_suitability_score"] = (proba[:, 1] + proba[:, 2]).round(3)
    else:
        df["ai_suitability_score"] = proba[:, -1].round(3)

    df["ai_predicted_class"] = clf.predict(X_scaled)

    # ----- Feature importance -----
    importance = dict(zip(available_features, clf.feature_importances_.tolist()))
    importance_sorted = dict(sorted(importance.items(), key=lambda x: x[1], reverse=True))

    # ----- SHAP explanations (if available) -----
    shap_summary = {}
    if SHAP_AVAILABLE:
        try:
            explainer = shap.TreeExplainer(clf)
            shap_vals = explainer.shap_values(X_scaled)
            # Mean absolute SHAP per class
            if isinstance(shap_vals, list):
                mean_abs = np.mean([np.abs(sv).mean(axis=0) for sv in shap_vals], axis=0)
            else:
                mean_abs = np.abs(shap_vals).mean(axis=0)
            shap_summary = dict(zip(available_features, mean_abs.tolist()))
            print("SHAP explanations computed.")
        except Exception as e:
            print(f"SHAP skipped: {e}")

    # ----- Risk analysis summary -----
    risk_summary: dict = {}
    for crop in df["crop"].unique():
        crop_df = df[df["crop"] == crop]
        risk_summary[crop] = {}
        for scenario in sorted(crop_df["scenario"].unique()):
            s_df = crop_df[crop_df["scenario"] == scenario]
            risk_summary[crop][scenario] = {
                "mean_suitability_score": round(s_df["suitability_score"].mean(), 3),
                "mean_ai_score": round(s_df["ai_suitability_score"].mean(), 3),
                "pct_high_risk": round((s_df["risk_class"] >= 3).mean() * 100, 1),
                "pct_critical": round((s_df["risk_class"] == 4).mean() * 100, 1),
                "mean_yield_gap_pct": round(s_df["yield_gap_pct"].mean(), 1),
                "mean_irrigation_mm": round(s_df["irrigation_demand_mm"].mean(), 1),
                "mean_heat_stress_days": round(s_df["heat_stress_days"].mean(), 1),
            }

    analysis_report = {
        "cv_f1_macro": round(float(cv_scores.mean()), 4),
        "cv_std": round(float(cv_scores.std()), 4),
        "feature_importance": importance_sorted,
        "shap_mean_abs": shap_summary,
        "risk_by_crop_scenario": risk_summary,
        "total_simulations": len(df),
        "crops_analysed": list(df["crop"].unique()),
        "scenarios_analysed": list(df["scenario"].unique()),
    }

    # ----- Save outputs -----
    out_csv = out_dir / "suitability_scores.csv"
    df.to_csv(out_csv, index=False)

    out_json = out_dir / "risk_analysis.json"
    with open(out_json, "w") as fh:
        json.dump(analysis_report, fh, indent=2)

    importance_path = out_dir / "feature_importance.json"
    with open(importance_path, "w") as fh:
        json.dump(importance_sorted, fh, indent=2)

    print(f"\nSuitability scores saved to: {out_csv}")
    print(f"Risk analysis saved to: {out_json}")

    print("\nTop 5 feature importances:")
    for feat, imp in list(importance_sorted.items())[:5]:
        print(f"  {feat:<35} {imp:.4f}")

    print("\nRisk distribution:")
    print(df["risk_label"].value_counts().to_string())

    print("\nMean suitability score by scenario:")
    print(df.groupby("scenario")["suitability_score"].mean().round(3).to_string())


if __name__ == "__main__":
    main()
