# pipeline/step7_tft_predict.py
from __future__ import annotations

import argparse
import json
import pathlib

import numpy as np
import pandas as pd
import torch
from pytorch_forecasting import TemporalFusionTransformer

try:
    from pipeline.tft_shared import build_datasets, load_and_prepare
except ModuleNotFoundError:
    from tft_shared import build_datasets, load_and_prepare


def resolve_checkpoint(path_value: str) -> pathlib.Path:
    candidate = pathlib.Path(path_value)
    if candidate.is_file():
        return candidate

    search_dir = candidate if candidate.is_dir() else candidate.parent
    matches = sorted(search_dir.glob("vegshift-tft-best*.ckpt"), key=lambda path: path.stat().st_mtime, reverse=True)
    if matches:
        return matches[0]

    raise FileNotFoundError(f"No checkpoint found at {candidate} or in {search_dir}")


def infer_tft(args: argparse.Namespace) -> None:
    checkpoint_path = resolve_checkpoint(args.checkpoint)

    df = load_and_prepare(args.input)
    _, validation = build_datasets(df, args.encoder_len, args.pred_len)
    val_loader = validation.to_dataloader(train=False, batch_size=args.batch_size, num_workers=0)

    model = TemporalFusionTransformer.load_from_checkpoint(str(checkpoint_path))
    model.eval()

    raw_predictions = model.predict(val_loader, mode="raw", return_x=True)
    prediction_tensor = raw_predictions.output.prediction
    prediction_values = prediction_tensor[:, 0, 3].detach().cpu().numpy()
    prediction_values = np.clip(prediction_values, 0.0, 1.0)

    prediction_output = validation.decoded_index.copy().reset_index(drop=True)
    prediction_output["predicted_cvle_score"] = prediction_values
    prediction_output = prediction_output.rename(columns={"time_idx_first_prediction": "time_idx"})
    prediction_output = prediction_output.merge(
        df[["city", "time_idx", "year"]],
        on=["city", "time_idx"],
        how="left",
    )
    prediction_output = prediction_output[["city", "year", "predicted_cvle_score"]].sort_values(["city", "year"]).reset_index(drop=True)
    prediction_output.to_csv(args.prediction_output, index=False)

    attention_tensor = getattr(raw_predictions.output, "encoder_attention", None)
    if attention_tensor is None:
        attention_out = {city: [] for city in df["city"].unique().tolist()}
    else:
        if isinstance(attention_tensor, torch.Tensor):
            attention_array = attention_tensor.detach().cpu().numpy()
        else:
            attention_array = np.asarray(attention_tensor)
        attention_array = attention_array.mean(axis=(1, 2))

        attention_frame = validation.decoded_index[["city"]].copy().reset_index(drop=True)
        for idx in range(attention_array.shape[1]):
            attention_frame[f"lag_{idx + 1}"] = attention_array[:, idx]

        attention_out = {}
        for city, city_frame in attention_frame.groupby("city", sort=True):
            lag_cols = [col for col in city_frame.columns if col.startswith("lag_")]
            values = city_frame[lag_cols].mean(axis=0).to_numpy(dtype=float)
            total = values.sum()
            if total > 0:
                values = values / total
            attention_out[city] = [round(float(v), 6) for v in values.tolist()]

    pathlib.Path(args.output_dir).mkdir(parents=True, exist_ok=True)
    with open(pathlib.Path(args.output_dir) / "tft_attention_weights.json", "w", encoding="utf-8") as handle:
        json.dump(attention_out, handle, indent=2)

    cvle_events = df[df["cvle_label"] == 1][[
        "city", "year", "crop", "koppen_zone", "dual_deficit",
        "sowing_window_miss", "crop_water_deficit",
        "gdd_adequate", "depletion_rate", "recharge_efficiency",
    ]].copy()
    cvle_events.to_json(pathlib.Path(args.output_dir) / "crop_viability_events.json", orient="records", indent=2)

    print(f"Predictions saved: {len(prediction_output)} rows")
    print(f"CVLE events: {len(cvle_events)}")
    print(f"Attention weights saved for {len(attention_out)} cities")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run TFT inference for VegShift (Step 7).")
    parser.add_argument("--input", default="data/processed/vegshift_master.csv")
    parser.add_argument("--checkpoint", default="models/tft/vegshift-tft-best.ckpt")
    parser.add_argument("--output-dir", default="data/output")
    parser.add_argument("--prediction-output", default="data/output/tft_predictions.csv")
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--encoder-len", type=int, default=5)
    parser.add_argument("--pred-len", type=int, default=1)
    return parser.parse_args()


if __name__ == "__main__":
    infer_tft(parse_args())

