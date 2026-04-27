# VegShift Steps 0 to 9 Runbook

This document explains how to run the VegShift project from scratch and what each implemented step does.

It is written so a teammate can follow it end to end without needing to guess which file comes next or why a step exists.

## What This Project Does

VegShift studies how climate change and groundwater stress affect crop viability in major Indian cities.

The pipeline does three main things:

1. Builds yearly city-level data from raw climate, groundwater, and crop-suitability sources.
2. Detects climate zone transitions and labels crop viability loss events.
3. Trains models and explainability tools to predict and interpret those events.

The implemented pipeline currently runs from Step 0 to Step 9.

## One-Time Setup

Run these commands from the project root:

```powershell
.\.venv\Scripts\Activate.ps1
python --version
pip install -r requirements.txt
```

If the virtual environment does not exist yet, create it first, then install dependencies.

## Recommended Run Order

Run the scripts in this exact sequence:

```powershell
python pipeline/step0_master_index.py
python pipeline/step0b_preprocess_datasets.py
python pipeline/step1_koppen_classification.py
python pipeline/step1b_transition_detection.py
python pipeline/step2_climate_aggregate.py
python pipeline/step3_groundwater_aggregate.py
python pipeline/step4_gaez_extract.py
python pipeline/step5_join_and_features.py
python pipeline/step6_tft_train.py
python pipeline/step7_tft_predict.py
python pipeline/step8_baselines.py
python pipeline/step9_shap_explainability.py
```

If you want to run the whole validated portion of the pipeline in one shot, you can also use:

```powershell
python run_vegshift.py
```

Note: `run_vegshift.py` lists later steps too, but only steps 0 to 9 are implemented in this workspace right now.

## Folder Map

The most important folders are:

- `data/raw/` for source data.
- `data/processed/` for cleaned and merged intermediate tables.
- `data/output/` for final analysis outputs and reports.
- `models/tft/` for the trained TFT checkpoint.
- `models/baselines/` for baseline model artifacts.
- `pipeline/` for the step scripts.

## Step-by-Step Guide

### Step 0 - Build the master city-year index

Script: [pipeline/step0_master_index.py](pipeline/step0_master_index.py)

Command:

```powershell
python pipeline/step0_master_index.py
```

What it does:

- Creates the backbone table of all city-year combinations.
- Gives every later step a shared join key.

Input:

- Hardcoded list of 10 cities.
- Years from 2000 to 2024.

Output:

- [data/processed/master_index.csv](data/processed/master_index.csv)

Why it is needed:

- Without this file, there is no common table to merge all the other datasets into one annual dataset.

What to expect:

- 250 rows total.
- 10 cities x 25 years.

### Step 0b - Preprocess raw climate data

Script: [pipeline/step0b_preprocess_datasets.py](pipeline/step0b_preprocess_datasets.py)

Command:

```powershell
python pipeline/step0b_preprocess_datasets.py
```

What it does:

- Reads the raw daily climate dataset.
- Renames columns into the project schema.
- Standardizes temperature, rainfall, and wind units.
- Derives humidity when it is not present in the raw file.

Input:

- [data/raw/climate/india_2000_2024_daily_weather.csv](data/raw/climate/india_2000_2024_daily_weather.csv)

Output:

- [data/processed/kaggle_climate.csv](data/processed/kaggle_climate.csv)

Why it is needed:

- All later climate calculations assume one consistent daily-climate table.

What to expect:

- A cleaned daily table ready for annual aggregation.

### Step 1 - Classify annual climate zones

Script: [pipeline/step1_koppen_classification.py](pipeline/step1_koppen_classification.py)

Command:

```powershell
python pipeline/step1_koppen_classification.py
```

What it does:

- Aggregates daily climate into annual summaries by city.
- Assigns a Köppen climate zone to each city-year.
- Encodes the zone as a number for modeling.

Input:

- [data/processed/kaggle_climate.csv](data/processed/kaggle_climate.csv)

Outputs:

- [data/processed/koppen_annual.csv](data/processed/koppen_annual.csv)
- [data/processed/zone_map.json](data/processed/zone_map.json)

Why it is needed:

- Climate zone change is one of the main signals used to define risk.

What to expect:

- One row per city-year with the annual Köppen classification.

### Step 1b - Detect climate zone transitions

Script: [pipeline/step1b_transition_detection.py](pipeline/step1b_transition_detection.py)

Command:

```powershell
python pipeline/step1b_transition_detection.py
```

What it does:

- Looks for years where a city changes from one Köppen zone to another.
- Requires the new zone to persist for multiple years so it is not just noise.

Input:

- [data/processed/koppen_annual.csv](data/processed/koppen_annual.csv)

Output:

- [data/output/transition_report.json](data/output/transition_report.json)

Why it is needed:

- The project does not just want climate categories. It wants the actual transition event and year.

What to expect:

- A list of detected city transitions such as from semi-arid to arid.

### Step 2 - Aggregate climate features for crops

Script: [pipeline/step2_climate_aggregate.py](pipeline/step2_climate_aggregate.py)

Command:

```powershell
python pipeline/step2_climate_aggregate.py
```

What it does:

- Converts daily climate into annual crop-relevant features.
- Computes things like annual mean temperature, total rainfall, monsoon onset, growing degree days, sowing-window miss, and water deficit.

Input:

- [data/processed/kaggle_climate.csv](data/processed/kaggle_climate.csv)

Output:

- [data/processed/climate_annual.csv](data/processed/climate_annual.csv)

Why it is needed:

- The models need annual features, not raw daily rows.

What to expect:

- A city-year table of atmospheric stress features.

### Step 3 - Aggregate groundwater features

Script: [pipeline/step3_groundwater_aggregate.py](pipeline/step3_groundwater_aggregate.py)

Command:

```powershell
python pipeline/step3_groundwater_aggregate.py
```

What it does:

- Matches nearby groundwater wells to each city.
- Computes pre-monsoon and post-monsoon groundwater depths.
- Derives depletion and recharge behavior.
- Handles Jaipur using a nearest-well fallback because local wells are missing.

Inputs:

- [data/raw/cgwb/CGWB_India_quality_controlled_GWLs_ref_sy_2000_2022.csv](data/raw/cgwb/CGWB_India_quality_controlled_GWLs_ref_sy_2000_2022.csv)
- [data/processed/climate_annual.csv](data/processed/climate_annual.csv)

Output:

- [data/processed/groundwater_annual.csv](data/processed/groundwater_annual.csv)

Why it is needed:

- Crop loss is not driven by climate alone. Groundwater stress is a major part of the story.

What to expect:

- A city-year groundwater table with depletion and recharge metrics.

### Step 4 - Extract crop suitability from GAEZ

Script: [pipeline/step4_gaez_extract.py](pipeline/step4_gaez_extract.py)

Command:

```powershell
python pipeline/step4_gaez_extract.py
```

What it does:

- Reads crop suitability rasters.
- Samples the raster value at each city location.
- Attaches crop-specific agronomic thresholds like minimum GDD and water requirement.

Inputs:

- GeoTIFF files in [data/raw/gaez](data/raw/gaez)
- City coordinates defined in the script

Output:

- [data/processed/gaez_baseline.csv](data/processed/gaez_baseline.csv)

Why it is needed:

- This gives the static baseline of what crops are generally suitable where.

What to expect:

- One row per city with crop baseline suitability and threshold values.

### Step 5 - Join all data and create labels

Script: [pipeline/step5_join_and_features.py](pipeline/step5_join_and_features.py)

Command:

```powershell
python pipeline/step5_join_and_features.py
```

What it does:

- Joins master index, climate, groundwater, GAEZ, and Köppen tables.
- Fills missing values.
- Creates compound features.
- Creates the CVLE label.

Inputs:

- [data/processed/master_index.csv](data/processed/master_index.csv)
- [data/processed/climate_annual.csv](data/processed/climate_annual.csv)
- [data/processed/groundwater_annual.csv](data/processed/groundwater_annual.csv)
- [data/processed/gaez_baseline.csv](data/processed/gaez_baseline.csv)
- [data/processed/koppen_annual.csv](data/processed/koppen_annual.csv)

Output:

- [data/processed/vegshift_master.csv](data/processed/vegshift_master.csv)

Why it is needed:

- This is the final tabular dataset used for all models and analysis.

What to expect:

- 250 rows.
- 33 columns.
- A `cvle_label` column showing labeled viability loss events.

### Step 6 - Train the TFT model

Script: [pipeline/step6_tft_train.py](pipeline/step6_tft_train.py)

Shared helper: [pipeline/tft_shared.py](pipeline/tft_shared.py)

Command:

```powershell
python pipeline/step6_tft_train.py
```

What it does:

- Turns the yearly city table into time-series sequences.
- Trains the Temporal Fusion Transformer to learn risk patterns over time.
- Saves the best model checkpoint.

Input:

- [data/processed/vegshift_master.csv](data/processed/vegshift_master.csv)

Output:

- Best checkpoint in [models/tft](models/tft)

Why it is needed:

- This is the main predictive model in the project.

What to expect:

- Training logs.
- A checkpoint file such as `vegshift-tft-best-v3.ckpt`.

### Step 7 - Predict with TFT and export attention

Script: [pipeline/step7_tft_predict.py](pipeline/step7_tft_predict.py)

Command:

```powershell
python pipeline/step7_tft_predict.py --checkpoint models/tft/vegshift-tft-best-v3.ckpt
```

What it does:

- Loads the trained TFT checkpoint.
- Generates prediction scores for the validation windows.
- Exports attention weights to show which past years influenced the prediction most.
- Saves the current CVLE events table.

Inputs:

- [data/processed/vegshift_master.csv](data/processed/vegshift_master.csv)
- TFT checkpoint from [models/tft](models/tft)

Outputs:

- [data/output/tft_predictions.csv](data/output/tft_predictions.csv)
- [data/output/tft_attention_weights.json](data/output/tft_attention_weights.json)
- [data/output/crop_viability_events.json](data/output/crop_viability_events.json)

Why it is needed:

- This turns the trained model into usable predictions and an explanation of what it focused on.

What to expect:

- Prediction rows for the cities in the validation windows.
- One attention-weight list per city.

### Step 8 - Train baseline models

Script: [pipeline/step8_baselines.py](pipeline/step8_baselines.py)

Command:

```powershell
python pipeline/step8_baselines.py
```

What it does:

- Trains three simpler comparison models: Random Forest, Logistic Regression, and LSTM.
- Computes their metrics.
- Saves the trained artifacts.

Input:

- [data/processed/vegshift_master.csv](data/processed/vegshift_master.csv)

Outputs:

- [models/baselines/rf_baseline.pkl](models/baselines/rf_baseline.pkl)
- [models/baselines/lr_baseline.pkl](models/baselines/lr_baseline.pkl)
- [models/baselines/lstm_baseline.pt](models/baselines/lstm_baseline.pt)
- [models/baselines/scaler.pkl](models/baselines/scaler.pkl)
- [data/output/baseline_metrics.json](data/output/baseline_metrics.json)

Why it is needed:

- The baseline models tell you whether the TFT is actually adding value.

What to expect:

- Classification metrics and AUC values for each baseline.

### Step 9 - Explain the baseline model with SHAP

Script: [pipeline/step9_shap_explainability.py](pipeline/step9_shap_explainability.py)

Command:

```powershell
python pipeline/step9_shap_explainability.py
```

What it does:

- Loads the trained Random Forest baseline.
- Computes SHAP values for the features.
- Summarizes which features matter most overall and per city.

Inputs:

- [data/processed/vegshift_master.csv](data/processed/vegshift_master.csv)
- [models/baselines/rf_baseline.pkl](models/baselines/rf_baseline.pkl)
- [models/baselines/scaler.pkl](models/baselines/scaler.pkl)

Output:

- [data/output/shap_explanation.json](data/output/shap_explanation.json)

Why it is needed:

- SHAP gives a human-readable explanation of why the model sees some cities as more at risk.

What to expect:

- A global feature ranking.
- A per-city feature ranking.

## Final Output Summary

After steps 0 to 9, you should have:

- Clean processed source data in `data/processed/`.
- Transition and prediction reports in `data/output/`.
- A trained TFT checkpoint in `models/tft/`.
- Baseline model files in `models/baselines/`.

## How To Verify Everything Ran Correctly

Check these files exist:

- [data/processed/vegshift_master.csv](data/processed/vegshift_master.csv)
- [data/output/transition_report.json](data/output/transition_report.json)
- [data/output/tft_predictions.csv](data/output/tft_predictions.csv)
- [data/output/baseline_metrics.json](data/output/baseline_metrics.json)
- [data/output/shap_explanation.json](data/output/shap_explanation.json)
- At least one TFT checkpoint in [models/tft](models/tft)
- Baseline files in [models/baselines](models/baselines)

## Simple One-Line Explanation

VegShift takes raw climate, groundwater, and crop suitability data, converts them into yearly city-level features, labels viability loss, trains prediction models, and then explains what the models learned.
