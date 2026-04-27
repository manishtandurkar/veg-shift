"""Step 8 - Train baseline models (RF, LR, LSTM) for CVLE prediction."""

from __future__ import annotations

import argparse
import json
import pathlib

import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.preprocessing import StandardScaler


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


def safe_auc(y_true: np.ndarray, y_prob: np.ndarray) -> float | None:
    if len(np.unique(y_true)) < 2:
        return None
    return float(roc_auc_score(y_true, y_prob))


def make_sequences(
    X: np.ndarray,
    y: np.ndarray,
    cities: np.ndarray,
    years: np.ndarray,
    seq_len: int,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    X_seq: list[np.ndarray] = []
    y_seq: list[float] = []
    year_seq: list[int] = []

    for city in np.unique(cities):
        idx = np.where(cities == city)[0]
        city_years = years[idx]
        order = np.argsort(city_years)
        idx = idx[order]

        X_city = X[idx]
        y_city = y[idx]
        years_city = years[idx]

        for i in range(seq_len, len(X_city)):
            X_seq.append(X_city[i - seq_len : i])
            y_seq.append(float(y_city[i]))
            year_seq.append(int(years_city[i]))

    return (
        np.asarray(X_seq, dtype=np.float32),
        np.asarray(y_seq, dtype=np.float32),
        np.asarray(year_seq, dtype=np.int32),
    )


class LSTMClassifier(nn.Module):
    def __init__(self, n_features: int, hidden_size: int = 64, layers: int = 2, dropout: float = 0.2) -> None:
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=n_features,
            hidden_size=hidden_size,
            num_layers=layers,
            batch_first=True,
            dropout=dropout,
        )
        self.fc = nn.Linear(hidden_size, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        _, (h_n, _) = self.lstm(x)
        logits = self.fc(h_n[-1])
        return torch.sigmoid(logits).squeeze(-1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train VegShift baseline models (Step 8).")
    parser.add_argument("--input", default="data/processed/vegshift_master.csv")
    parser.add_argument("--output-dir", default="models/baselines")
    parser.add_argument("--metrics-output", default="data/output/baseline_metrics.json")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--seq-len", type=int, default=5)
    parser.add_argument("--lstm-epochs", type=int, default=30)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)

    df = pd.read_csv(args.input)
    missing_cols = [col for col in FEATURES + ["cvle_label", "year", "city"] if col not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing required columns in input data: {missing_cols}")

    model_df = df.dropna(subset=FEATURES + ["cvle_label", "year", "city"]).copy()
    X = model_df[FEATURES].to_numpy(dtype=float)
    y = model_df["cvle_label"].to_numpy(dtype=int)

    train_mask = model_df["year"] <= 2018
    test_mask = model_df["year"] >= 2022
    if train_mask.sum() == 0 or test_mask.sum() == 0:
        raise ValueError("Train/test year split produced empty set. Check year values in input data.")

    scaler = StandardScaler()
    X_train = scaler.fit_transform(X[train_mask])
    X_test = scaler.transform(X[test_mask])
    y_train = y[train_mask]
    y_test = y[test_mask]

    rf = RandomForestClassifier(
        n_estimators=300,
        max_depth=6,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=args.seed,
    )
    rf.fit(X_train, y_train)
    rf_pred = rf.predict(X_test)
    rf_prob = rf.predict_proba(X_test)[:, 1]

    lr = LogisticRegression(
        class_weight="balanced",
        max_iter=2000,
        random_state=args.seed,
    )
    lr.fit(X_train, y_train)
    lr_pred = lr.predict(X_test)
    lr_prob = lr.predict_proba(X_test)[:, 1]

    X_all_scaled = scaler.transform(X)
    X_seq, y_seq, year_seq = make_sequences(
        X_all_scaled,
        y.astype(float),
        model_df["city"].to_numpy(),
        model_df["year"].to_numpy(),
        seq_len=args.seq_len,
    )

    lstm_train_mask = year_seq <= 2018
    lstm_test_mask = year_seq >= 2022
    if lstm_train_mask.sum() == 0 or lstm_test_mask.sum() == 0:
        raise ValueError("LSTM sequence year split produced empty set. Check sequence length and year coverage.")

    X_seq_train = torch.tensor(X_seq[lstm_train_mask])
    y_seq_train = torch.tensor(y_seq[lstm_train_mask])
    X_seq_test = torch.tensor(X_seq[lstm_test_mask])
    y_seq_test = y_seq[lstm_test_mask]

    lstm = LSTMClassifier(n_features=X_seq.shape[2])
    optimizer = torch.optim.Adam(lstm.parameters(), lr=1e-3)
    loss_fn = nn.BCELoss()

    lstm.train()
    for _ in range(args.lstm_epochs):
        optimizer.zero_grad()
        y_pred = lstm(X_seq_train)
        loss = loss_fn(y_pred, y_seq_train)
        loss.backward()
        optimizer.step()

    lstm.eval()
    with torch.no_grad():
        lstm_prob = lstm(X_seq_test).cpu().numpy()
        lstm_pred = (lstm_prob >= 0.5).astype(int)

    metrics = {
        "random_forest": {
            "classification_report": classification_report(y_test, rf_pred, output_dict=True, zero_division=0),
            "auc": safe_auc(y_test, rf_prob),
        },
        "logistic_regression": {
            "classification_report": classification_report(y_test, lr_pred, output_dict=True, zero_division=0),
            "auc": safe_auc(y_test, lr_prob),
        },
        "lstm": {
            "classification_report": classification_report(y_seq_test.astype(int), lstm_pred, output_dict=True, zero_division=0),
            "auc": safe_auc(y_seq_test.astype(int), lstm_prob),
            "seq_len": args.seq_len,
        },
    }

    out_dir = pathlib.Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    pathlib.Path(args.metrics_output).parent.mkdir(parents=True, exist_ok=True)

    joblib.dump(rf, out_dir / "rf_baseline.pkl")
    joblib.dump(lr, out_dir / "lr_baseline.pkl")
    joblib.dump(scaler, out_dir / "scaler.pkl")
    torch.save(lstm.state_dict(), out_dir / "lstm_baseline.pt")

    with open(args.metrics_output, "w", encoding="utf-8") as handle:
        json.dump(metrics, handle, indent=2)

    print("Baseline models saved to models/baselines")
    print(f"RF AUC: {metrics['random_forest']['auc']}")
    print(f"LR AUC: {metrics['logistic_regression']['auc']}")
    print(f"LSTM AUC: {metrics['lstm']['auc']}")


if __name__ == "__main__":
    main()