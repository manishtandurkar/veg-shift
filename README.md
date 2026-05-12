# VegShift

**Vegetation Viability Loss Detection After Climate Zone Transitions in Indian Cities**

VegShift is a standalone ML pipeline that answers one question: *after a city's Koppen-Geiger climate zone shifts, which crops can no longer be grown there, and when exactly did that become true?*

It fuses three independent datasets (atmospheric climate, groundwater levels, crop suitability maps), detects persistent climate zone transitions, and produces formally timestamped **Crop Viability Loss Events (CVLEs)** — the exact year a city's climate permanently crossed below a crop's minimum viability threshold.

**Cities:** Delhi, Mumbai, Chennai, Kolkata, Bangalore, Hyderabad, Ahmedabad, Jaipur, Lucknow, Pune  
**Time range:** 2000–2024 (25 years, 250 city-year rows)  
**Primary model:** Temporal Fusion Transformer (5-year lookback, quantile output)  
**Baselines:** Random Forest, Logistic Regression, LSTM  
**Explainability:** SHAP (TreeExplainer), TFT attention weights  
**Dashboard:** 11-panel interactive Dash/Plotly app at `localhost:8050`

See [AGENTS.md](AGENTS.md) for full pipeline design and dataset specifications.  
See [docs/explanation.md](docs/explanation.md) for a beginner-friendly walkthrough of every concept and step.

---

## How It Works

VegShift detects a **Crop Viability Loss Event (CVLE)** when all of the following are true:

1. **Dual-deficit active for 2+ consecutive years** — both atmospheric water deficit >40% AND groundwater recharge efficiency <30% (the farmer can't use rainfall OR wells as backup)
2. **At least 2 of 3 thresholds breached** in the current year:
   - Sowing window missed by >60% (monsoon too late to plant)
   - Crop water deficit >40% (too dry)
   - Growing Degree Days insufficient for the crop to mature

Transitions between Koppen zones (e.g., Cwa → BSh for Delhi in 2003) are detected using a 3-year persistence filter to eliminate single-year noise. Causal linkage analysis (Wilcoxon test) then confirms whether each transition caused a statistically significant rise in CVLE risk.

---

## Setup

```bash
pip install -r requirements.txt
```

**Python 3.10+ recommended.**

Key dependencies:

| Package | Purpose |
|---|---|
| pandas, numpy, scipy | Data processing and statistics |
| scikit-learn, joblib | Random Forest, Logistic Regression, StandardScaler |
| torch, pytorch-lightning | TFT and LSTM deep learning models |
| pytorch-forecasting | Temporal Fusion Transformer implementation |
| rasterio | Read FAO GAEZ GeoTIFF crop suitability rasters |
| shap | SHAP TreeExplainer for Random Forest |
| plotly, dash | Interactive 8-panel dashboard |
| pytest | 29 automated tests |

---

## Data

All three datasets are pre-downloaded. Do not move or rename them.

| # | Dataset | Raw Location | Notes |
|---|---|---|---|
| DS1 | Daily climate (Open-Meteo / Kaggle) | `data/raw/climate/india_2000_2024_daily_weather.csv` | ~91,000 daily rows. Humidity derived (not in source). Standardized by step0b → `data/processed/kaggle_climate.csv` |
| DS2 | CGWB groundwater levels | `data/raw/cgwb/CGWB_India_quality_controlled_GWLs_ref_sy_2000_2022.csv` | Well measurements Jan/May/Aug/Nov 2000–2022. Rajasthan absent (Jaipur uses nearest-well fallback). Kolkata has no May readings (global-median fallback applied in step5). Dataset ends 2022; years 2023–2024 marked `gw_imputed=1`. |
| DS3 | FAO GAEZ crop suitability | `data/raw/gaez/*.tif` | 6 GeoTIFF rasters (wheat, cotton, rice, sugarcane, mustard, ragi). Suitability scale 1–7; values >7 clipped. |

---

## Run

### Full pipeline (17 steps, sequential)

```bash
python run_vegshift.py
```

### Dry run — list all steps without executing

```bash
python run_vegshift.py --dry-run
```

### Individual steps

```bash
# Phase 1: Data processing (Steps 0-4)
python pipeline/step0_master_index.py          # 250-row skeleton: 10 cities x 25 years
python pipeline/step0b_preprocess_datasets.py  # Standardize columns, derive humidity
python pipeline/step1_koppen_classification.py # Koppen zone per city-year
python pipeline/step1b_transition_detection.py # Detect persistent zone transitions (3+ yr)
python pipeline/step2_climate_aggregate.py     # Annual features: GDD, monsoon onset, water deficit
python pipeline/step3_groundwater_aggregate.py # City-level GW: depletion rate, recharge efficiency
python pipeline/step4_gaez_extract.py          # Crop suitability + ECOCROP thresholds per city

# Phase 2: Integration and labeling (Step 5)
python pipeline/step5_join_and_features.py     # Three-way join + dual-deficit + CVLE labels

# Phase 3: Machine learning (Steps 6-9)
python pipeline/step6_tft_train.py             # Train TFT (5-yr lookback, quantile output)
python pipeline/step7_tft_predict.py           # TFT predictions + attention weight extraction
python pipeline/step8_baselines.py             # Train RF + LR + LSTM baseline models
python pipeline/step9_shap_explainability.py   # SHAP TreeExplainer on Random Forest

# Phase 4: Analysis and validation (Steps 10-13)
python pipeline/step10_causal_linkage.py       # Wilcoxon test: pre vs post transition CVLE risk
python pipeline/step11_trend_regression.py     # Linear slope of CVLE risk per city, 2000-2024
python pipeline/step12_control_validation.py   # Validate control cities (Pune, Kolkata, Mumbai)
python pipeline/step13_recharge_grid.py        # Export recharge grid JSON for dashboard

# Phase 5: Advisory Engines (Steps 15-17)
python pipeline/step15_crop_advisory.py        # Rank 14 Indian crops per city with trajectory penalty
python pipeline/step16_irrigation_strategy.py  # RSI-level irrigation prescriptions + govt schemes
python pipeline/step17_exploitation_risk.py    # ERI score, distress alert, MSP, procurement links

# Phase 6: Dashboard (Step 14 — launches in background after pipeline completes)
python pipeline/step14_dashboard.py            # Launch Dash app at localhost:8050
```

---

## Tests

```bash
pytest tests/
```

29 tests pass. Coverage:

| Test file | What it checks |
|---|---|
| `tests/test_runner.py` | Orchestrator exists, has 17 steps, dry-run exits 0, all scripts are `pipeline/*.py` |
| `tests/test_datasets.py` | All 3 raw dataset files exist and are non-empty |
| `tests/test_pipeline_outputs.py` | Processed CSVs exist with correct row counts; output JSONs exist; model files exist |
| `tests/test_data_integrity.py` | `vegshift_master.csv` has 250 rows, 10 cities, 0 NaN in key GW columns |

---

## Output Files

### Processed data (`data/processed/`)

| File | Rows | Description |
|---|---|---|
| `master_index.csv` | 250 | City × year skeleton (10 cities × 25 years) |
| `kaggle_climate.csv` | ~91,000 | Standardized daily climate with derived humidity |
| `koppen_annual.csv` | 250 | Koppen zone classification per city-year |
| `zone_map.json` | — | Koppen label → integer encoding |
| `climate_annual.csv` | 250 | 12 aggregated annual features per city-year |
| `groundwater_annual.csv` | 250 | 6 city-level GW metrics per city-year |
| `gaez_baseline.csv` | 10 | Crop suitability + ECOCROP thresholds per city |
| `vegshift_master.csv` | 250 | Master joined dataset with all features + CVLE labels |

### Analysis output (`data/output/`)

| File | Description |
|---|---|
| `transition_report.json` | Detected persistent Koppen transitions (city, year, from/to zone) |
| `crop_viability_events.json` | All CVLE events with timestamps and triggering features |
| `transition_cvle_linkage.json` | Wilcoxon test results per transition (pre/post risk, p-value, CVLE lag) |
| `viability_trend_report.json` | 25-year linear slope + significance per city (deteriorating/stable/improving) |
| `shap_explanation.json` | SHAP feature importance — global and per-city |
| `tft_attention_weights.json` | TFT temporal attention weights (which past years mattered per prediction) |
| `tft_predictions.csv` | TFT quantile predictions (10th–90th percentile) for all city-years |
| `groundwater_recharge_grid.json` | Recharge efficiency grid: city → year → value |
| `baseline_metrics.json` | RF / LR / LSTM test-set F1, accuracy, ROC-AUC |
| `crop_advisory.json` | Per-city ranked suitability scores for 14 Indian crops with 5-yr trajectory penalty |
| `irrigation_strategy.json` | RSI level, irrigation method, avoid-crop list, optimal sowing window, government schemes |
| `exploitation_risk_report.json` | ERI score, alert flag, MSP, distress price threshold, alternative crops, procurement links |

### Models (`data/output/`)

| File | Description |
|---|---|
| `vegshift-tft-best.ckpt` | Best TFT checkpoint (PyTorch Lightning) |
| `rf_baseline.pkl` | Random Forest classifier (scikit-learn) |
| `lr_baseline.pkl` | Logistic Regression classifier |
| `scaler.pkl` | StandardScaler fitted on training split |
| `lstm_baseline.pt` | LSTM state dict (PyTorch) |

---

## Dashboard

After running the pipeline, open `http://localhost:8050`. The dashboard launches automatically in the background when `run_vegshift.py` completes.

Eleven panels:

| # | Panel | What it shows |
|---|---|---|
| 1 | Sowing Window Drift | Monsoon onset day vs. optimal sowing date per city, with transition year markers |
| 2 | Dual-Deficit Heatmap | City × year grid — red cells = both atmospheric + GW failed simultaneously |
| 3 | CVLE Timeline | Bar chart of CVLE event counts per city (control cities in gray) |
| 4 | Transition → CVLE Linkage | Table: all transitions, Wilcoxon p-value, risk delta (%), CVLE lag (years) |
| 5 | Recharge Efficiency Trend | Groundwater recovery per city over 25 years (falling line = aquifer damage) |
| 6 | Koppen Zone History | Zone label per city per year (scatter/timeline) |
| 7 | SHAP Feature Importance | Global + per-city feature contribution bar charts |
| 8 | Trend Report | 25-year viability risk slope per city, color-coded by trend |
| 9 | Crop Advisory | Top-ranked crops per city scored on zone fit, temperature, rainfall, GW stress, and 5-yr trajectory |
| 10 | Irrigation Strategy | Groundwater depth per city with RSI level colour coding and recommended irrigation method |
| 11 | Exploitation Risk | Stacked ERI component bar chart per city with alert threshold line |

All charts support hover tooltips and city filtering.

---

## Key Design Decisions

**Why dual-deficit?**  
Single-factor thresholds (e.g., "rainfall < X mm") generate too many false positives. Requiring both atmospheric and subsurface failure simultaneously ensures the farmer has no backup water source and the event is a real crisis.

**Why 3-year persistence for Koppen transitions?**  
Classifying a single anomalous year as a permanent zone transition inflates the transition count. Requiring 3+ consecutive years in the new zone filters noise while still detecting real multi-year shifts.

**Why TFT over simpler models?**  
Crops respond to multi-year patterns (consecutive droughts, gradual aquifer depletion). TFT's 5-year lookback and attention mechanism capture temporal dependencies that cross-sectional models (RF, LR) miss. Baselines are trained alongside for comparison.

**Why control cities?**  
Pune, Kolkata, and Mumbai are expected to remain climatically stable and agriculturally viable through 2024. If the pipeline reports CVLEs or deteriorating trends for these cities, the labels or model have a bug — control validation is the last sanity check before trusting any result.

---

## Project Structure

```
VegShift/
  pipeline/          # 17 step scripts (step0 through step17)
  data/
    raw/             # Original unmodified source files
      climate/       # DS1: daily climate CSV
      cgwb/          # DS2: groundwater CSV
      gaez/          # DS3: crop suitability TIFFs
    processed/       # Intermediate cleaned/aggregated files
    output/          # Final analysis outputs and trained models
  tests/             # pytest test suite (29 tests)
  docs/
    explanation.md   # Beginner-friendly walkthrough of all concepts and steps
  run_vegshift.py    # Pipeline orchestrator (--dry-run flag supported)
  AGENTS.md          # Full technical spec: datasets, algorithms, step implementations
  requirements.txt   # Python dependencies
```
