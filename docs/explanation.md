# VegShift Technical Explanation
## Vegetation Viability Loss Detection After Climate Zone Transitions in Indian Cities

---

## Project Purpose

VegShift is a data-driven pipeline designed to answer a critical agricultural question: **After a city's climate zone shifts, which crops can no longer be grown there, and when exactly did that become true?**

The core output is a formally timestamped **Crop Viability Loss Event (CVLE)**—a year marker indicating when a city's climate permanently crossed below the minimum threshold for its primary crop, with supporting diagnostics (groundwater state, atmospheric conditions, trend analysis, and causal linkage to climate transitions).

**Scope**: 10 Indian cities (Delhi, Mumbai, Chennai, Kolkata, Bangalore, Hyderabad, Ahmedabad, Jaipur, Lucknow, Pune) over 25 years (2000–2024).

---

## Data Architecture

### Dataset 1: Atmospheric Layer (Kaggle Historical Climate)
- **Source**: Daily weather observations (temperature, rainfall, wind, humidity) for 10 cities, 2000–2024.
- **Preprocessing**: Standardization of column names, derivation of missing humidity via apparent-temperature inversion (Steadman formula), normalization of wind units.
- **Output**: `kaggle_climate.csv` (standardized daily records).
- **Used for**:
  - Koppen-Geiger climate zone classification (annual aggregates).
  - Growing Degree Days (GDD) accumulation over crop-specific windows.
  - Monsoon onset detection (IMD-like 5-day rainfall rule).
  - Sowing-window timing and miss calculations.
  - Annual climate feature engineering (temps, rainfall, wind, humidity, dry months).
  - Crop water deficit computation.

### Dataset 2: Groundwater Layer (CGWB Quality-Controlled)
- **Source**: 2,759 quality-controlled observation wells across India with seasonal depth measurements (Jan, May, Aug, Nov, 2000–2022) and specific yield (Sy) per well.
- **Spatial aggregation**: 50 km radius median for each city; nearest-wells fallback when zero wells exist locally (e.g., Jaipur).
- **Imputation strategy**: Early years (pre-2005) use later-period depletion-rate baselines; missing wells are flagged (`gw_imputed` = 0/1/2) to maintain provenance.
- **Output**: `groundwater_annual.csv`.
- **Derived metrics**:
  - Pre-monsoon and post-monsoon depth (metres below ground level, mbgl).
  - Depletion rate (year-over-year pre-monsoon change).
  - Recharge efficiency (depth recovery normalized by annual rainfall).
- **Used for**:
  - Groundwater depletion trends.
  - Compound "dual-deficit" indicators (concurrent atmospheric and subsurface failure).
  - Groundwater visualization and trend analysis in dashboard.

### Dataset 3: Crop Suitability & Agronomic Thresholds (FAO GAEZ v4 + ECOCROP)
- **Source**: FAO GAEZ suitability rasters (~9 km resolution, 1981–2010 baseline) for 53 crops and ECOCROP crop-specific constraints.
- **Extraction**: Sample rasters at city coordinates to obtain baseline suitability class (1–7 rainfed scale).
- **Handling**: Raster values sometimes encode irrigated categories (8–10); clipped to max 7 for consistency.
- **Output**: `gaez_baseline.csv`.
- **Per-crop thresholds** (from ECOCROP):
  - Minimum GDD for maturity (e.g., wheat 1200, sugarcane 2500).
  - Seasonal water requirement (mm).
  - Sowing window day-of-year (DOY).
  - Maximum temperature tolerance.
- **Used for**:
  - Reference thresholds against which observed climate is tested.
  - Defining viability conditions in CVLE labeling logic.

### Master Index
- Cartesian product of (10 cities × 25 years) = 250 rows.
- Serves as the join key for all three datasets and is the row space for the entire modeling pipeline.

---

## Preprocessing & Standardization

### Humidity Derivation
When relative humidity is absent from the raw dataset, it is derived from apparent temperature (AT) using inversion:

```
- Compute vapor pressure (e) and saturation pressure (es)
- Derive relative humidity (RH) as (e / es) × 100, clipped to [5%, 100%]
- Validate against climatological means (e.g., Mumbai 90%, Delhi 74%, Jaipur 65%)
```

### Standardized Columns
All preprocessing steps coalesce raw source columns into canonical names (e.g., `temperature_2m_max` → `temp_max`, `precipitation_sum` → `rainfall`) and units (e.g., wind speed converted to m/s).

### Processed Output
A single `kaggle_climate.csv` is persisted with standardized schema and becomes the authoritative atmospheric layer for all downstream steps.

---

## Koppen-Geiger Climate Zone Classification

### Why Koppen?
Climate zones are the primary predictor of crop viability. Tracking zone changes reveals when a region's climate fundamentally shifts—from tropical to semi-arid, semi-arid to arid, etc.—which often correlates with crop loss.

### Classification Logic
For each city-year, compute annual and monthly summaries:
- Mean annual temperature (T_ann).
- Total annual precipitation (P_ann).
- Temperature extremes (coldest/hottest month).
- Precipitation extremes (driest/wettest month).
- Seasonal sums (April–September, October–March).

Apply simplified Koppen decision rules:
- **Aridity threshold (Pth)**: Depends on precipitation seasonality; formula is `20 × (T + c)` where c ∈ {0, 140, 280} depending on seasonal concentration.
- **Zone classification**: 
  - B (Arid/Semi-arid) if P < Pth; further split into BWh (hot), BWk (cold), BSh (semi-arid hot), BSk (semi-arid cold).
  - A (Tropical) if T_min ≥ 18; further split by dry-season severity (Af, Am, Aw).
  - C (Temperate) if 0 ≤ T_min < 18; further split by seasonal precipitation patterns.

### Output
- Per-city-year zone string (e.g., "BSh", "Cwa", "Am").
- Integer encoding of zones for model consumption (`koppen_zone_enc`).
- Zone mapping (`zone_map.json`) for decoding.

---

## Transition Detection

### Definition
A **climate zone transition** is a persistent change from one Koppen zone to another, confirmed over a configurable persistence window (default: 3 years).

### Algorithm
- For each city, sequence annual Koppen zones chronologically.
- When a zone change occurs (year i → year i+1), check if the new zone holds for at least the persistence window (e.g., years i+1, i+2, i+3).
- If confirmed, record the transition (city, year, from_zone, to_zone, years_confirmed).

### Output
- `transition_report.json`: List of all detected transitions.
- Used as annotations on dashboard timelines and as inputs to causal linkage analysis.

### Interpretation
Persistent transitions indicate genuine climate shifts (not noise/variability) and are the anchor points for testing whether CVLE events follow zone changes.

---

## Climate Feature Engineering

### Annual Aggregation
Convert daily weather into annual city-level features capturing crop-relevant climatic conditions:

#### Core Climatic Features
- **temp_mean, temp_max, rainfall_annual, wind_speed, humidity**: Annual averages/sums.
- **n_dry_months**: Count of months with rainfall < 60 mm.

#### Crop-Specific Growth Metrics
- **monsoon_onset_doy**: Day-of-year when monsoon rains begin (IMD rule: first 5-day window after DOY 121 with ≥ 3 days ≥ 2.5 mm rain).
- **sowing_window_miss**: Normalized penalty if monsoon onset delays past optimal sowing window (0 to 1 scale).
- **gdd_accumulation**: Growing Degree Days integrated over crop-growing season (April–September) using crop-specific base temperature.
- **crop_water_deficit**: Normalized shortfall of seasonal rainfall vs. crop water requirement (0 to 1 scale).

### Output
- `climate_annual.csv`: 250 rows (10 cities × 25 years), 12 feature columns.
- Each row represents a city-year with annual aggregates ready for modeling.

---

## Groundwater Aggregation

### Spatial Aggregation
- For each city, identify all CGWB wells within 50 km radius.
- Compute median pre-monsoon (May) and post-monsoon (November) depths across available years.
- If a city has zero wells (e.g., Jaipur), use the 5 nearest wells (nearest-wells fallback) and flag with `gw_imputed = 2`.

### Temporal Features
- **pre_monsoon_depth_mbgl**: Depth before monsoonal recharge (proxy for base depletion state).
- **post_monsoon_depth_mbgl**: Depth after recharge (reflects aquifer recovery).
- **depletion_rate**: Year-over-year change in pre-monsoon depth (positive = further depletion).
- **recharge_efficiency**: (Post-monsoon recovery) / (Annual rainfall), clipped to [0, 1]; reflects aquifer's ability to recover per unit rainfall.

### Imputation & Flagging
- **Pre-2005 depletion rates**: Backfilled using median depletion rate from 2005–2007 for that city (insufficient well data before 2005).
- **Provenance flag `gw_imputed`**:
  - 0 = within 50 km radius median (authoritative).
  - 1 = interpolated or mean-filled later but within 50 km.
  - 2 = nearest-wells fallback (city had no local wells).

### Output
- `groundwater_annual.csv`: 250 rows, 6 columns (city, year, depths, rates, efficiency, flags).

---

## GAEZ Baseline Extraction

### Raster Sampling
- For each city, extract FAO GAEZ suitability raster values at city coordinates (lat/lon).
- Rasters are ~9 km resolution GeoTIFFs covering 53 crop types (wheat, cotton, rice, sugarcane, etc.).
- One raster per crop; cities are paired with their primary crop(s).

### Value Interpretation
- Raster pixels encode suitability classes:
  - 1–7 = rainfed potential (very low to very high).
  - 8–10 = irrigated potential (observed in some TIFFs but not fully documented).
- Clip all values to max 7 to harmonize with ECOCROP's rainfed-only reference scale.

### Per-Crop ECOCROP Thresholds
- Static attributes per crop-city pair:
  - **gdd_min**: Minimum GDD for maturity.
  - **water_req**: Seasonal water requirement (mm).
  - **sow_doy**: Optimal sowing window (day-of-year).
  - **max_temp**: Maximum tolerable temperature.
- These are reference thresholds used to define viability breach conditions in CVLE labeling.

### Output
- `gaez_baseline.csv`: 10 rows (one per city), including crop name, suitability class, and ECOCROP thresholds.

---

## Three-Way Join & Feature Integration

### Merge Strategy
- Start with `master_index.csv` (250 rows: city × year).
- Left-join `climate_annual.csv` on (city, year).
- Left-join `groundwater_annual.csv` on (city, year).
- Left-join `gaez_baseline.csv` on city (static broadcast across all years).
- Left-join `koppen_annual.csv` on (city, year).
- Result: `vegshift_master.csv` with 250 rows and ~30 columns.

### Imputation
- Residual missing numerical values are filled by city-group mean to avoid information leakage across cities.
- Missing monsoon_onset_doy, sowing_window_miss, gdd_accumulation are filled with city-year means.
- This is done post-merge to handle edge cases (e.g., if CGWB data is sparse).

### Output
- `vegshift_master.csv`: Master table with all features, targets, and metadata for modeling.

---

## Compound Feature Engineering

### Dual-Deficit Indicator
- Simultaneous failure of atmospheric and subsurface water availability.
- **Condition**: (`crop_water_deficit` > 0.4) AND (`recharge_efficiency` < 0.30).
- **Interpretation**: Heavy rainfall shortfall AND groundwater aquifer unable to recover efficiently.
- **Value**: Binary (0/1) per city-year.

### GDD Adequacy Indicator
- **Condition**: `gdd_accumulation` ≥ crop-specific `gdd_min`.
- **Value**: Binary (0/1) per city-year.
- **Interpretation**: Whether accumulated heat is sufficient for crop maturation.

### Purpose
These compound indicators reduce dimensionality and focus the model on integrated stress conditions rather than isolated univariate thresholds.

---

## CVLE Label Engineering

### Definition
A **Crop Viability Loss Event (CVLE)** is a formally triggered label indicating persistent multi-factor crop failure:

**Condition (conjunctive)**:
1. **Dual-deficit persistence**: `dual_deficit` = 1 for at least 2 consecutive years.
2. **Multi-threshold breach**: At least 2 of 3 thresholds breached in the most recent year:
   - **T1**: `sowing_window_miss` > 0.6 (extreme delay of growing season).
   - **T2**: `crop_water_deficit` > 0.4 (severe rainfall shortage).
   - **T3**: `gdd_adequate` = 0 (insufficient accumulated heat).

### Rationale
- **Persistence**: Single-year anomalies are filtered; only multi-year stress compounds trigger CVLE.
- **Multi-threshold**: Ensures viability loss is driven by multiple failure modes (not just one factor).
- **Conservative**: Design favors low false-positive rate over high sensitivity.

### Output
- `cvle_label`: Binary per city-year (0 = viable, 1 = CVLE).
- Imbalanced label (most years are 0; CVLEs are sparse) is handled by class-weight balancing in model training.

---

## Modeling Strategy

### Temporal Fusion Transformer (TFT)

#### Why TFT?
- Handles time series with multiple feature types (static categorical, static real, time-varying known, time-varying unknown).
- Attention mechanisms provide interpretability: identify which past timesteps drive predictions.
- Probabilistic output (quantile loss) enables calibrated risk scores rather than hard binary predictions.
- Suitable for relatively short sequences (5-year lookback) and small datasets (250 rows with temporal structure).

#### Architecture & Inputs
- **Encoder length**: 5 years (lookback window).
- **Prediction horizon**: 1 year (forecast next year's CVLE probability).
- **Time index**: Absolute (per city: years 0–24).
- **Static categoricals**: city, crop.
- **Static reals**: gaez_baseline_class, gdd_min, water_req, sow_doy, max_temp.
- **Time-varying known reals**: temp_mean, temp_max, rainfall_annual, wind_speed, humidity, n_dry_months, monsoon_onset_doy, sowing_window_miss, gdd_accumulation, crop_water_deficit, pre_monsoon_depth_mbgl, depletion_rate, recharge_efficiency, dual_deficit, gdd_adequate, koppen_zone_enc (categorical but encoded).
- **Time-varying unknown reals**: cvle_label (target).

#### Training
- Split: Years 0–18 (encoder) = training; years 0–21 (encoder) = validation; years 0–24 = full dataset.
- Loss: QuantileLoss (7 quantiles: 0.1, 0.25, 0.5, 0.75, 0.9, and two additional) enables probabilistic predictions.
- Normalization: GroupNormalizer by city (rescale per-city distributions independently to prevent across-city leakage).
- Regularization: Dropout, gradient clipping.
- Early stopping: Monitor validation loss; checkpoint best model.

#### Outputs
- **Predicted CVLE probability**: Median quantile (index 3) for each city-year.
- **Attention weights**: Per-city average attention over the 5-year encoder window, revealing which years drive the model's decisions.

### Baseline Models

#### Random Forest Classifier
- **Features**: Same 17 time-varying features (excluding koppen_zone_enc; use raw values).
- **Hyperparameters**: 200 trees, max_depth=6, class_weight='balanced' (handle imbalance).
- **Purpose**: Non-temporal baseline for comparison; simpler interpretation (feature importances via permutation/GINI).

#### Logistic Regression
- **Features**: Same 17 features, standardized.
- **Purpose**: Linear baseline to test if nonlinear complexity (TFT, RF) is necessary.

#### LSTM Baseline
- **Sequence construction**: Fixed-length (5-year) sequences per city with sliding window.
- **Architecture**: Bidirectional LSTM (2 layers, 64 hidden units) → linear classifier.
- **Purpose**: Temporal baseline capturing sequential patterns without the TFT's attention or architectural specifics.

#### Model Selection
- Baselines are used primarily for validation (e.g., comparative ROC-AUC, precision-recall) and sanity checks (e.g., models should agree qualitatively on at-risk cities).

---

## Explainability & Diagnostics

### SHAP Analysis (Random Forest)
- **Method**: TreeExplainer on the Random Forest to compute Shapley values for each sample and feature.
- **Outputs**:
  - **Global importance**: Mean absolute SHAP per feature across all samples; identifies which features contribute most to CVLE predictions (e.g., crop_water_deficit, depletion_rate, dual_deficit).
  - **Per-city importance**: Rank top-5 contributors per city (e.g., Delhi may weight sowing_window_miss heavily; Chennai may emphasize rainfall patterns).
- **Export**: `shap_explanation.json` (global + per-city rankings).
- **Dashboard**: Selectible view of global vs. city-specific feature importance.

### TFT Attention Interpretation
- **Method**: Extract attention weights from the TFT encoder over the 5-year lookback.
- **Interpretation**: Normalized weights indicate which historical years the TFT relied on to forecast year t+1's CVLE.
  - **Recent attention**: Model trusts recent dynamics.
  - **Early-year attention**: Model identifies longer-term trends or initialization effects.
- **Export**: `tft_attention_weights.json` (per-city average attention profile).
- **Dashboard**: Visualize attention weights as a bar chart or heatmap per city.

---

## Causal Linkage Analysis (M3)

### Transition → CVLE Linkage
Test whether detected climate zone transitions are followed by increased CVLE risk.

#### Per-Transition Analysis
For each transition (city, transition_year):
- **Pre-period**: Years {transition_year - 3, ..., transition_year - 1} CVLE risks.
- **Post-period**: Years {transition_year + 1, ..., transition_year + 3} CVLE risks.
- **Statistical test**: Wilcoxon signed-rank test (paired, nonparametric) to assess pre/post CVLE risk difference.
- **CVLE lag**: Years elapsed from transition to first post-transition CVLE event (or None if no CVLE follows).

#### Output Metrics
- **risk_delta**: Post-period mean CVLE risk − pre-period mean.
- **p_value**: Wilcoxon test p-value (reject H0 if p < 0.05 indicates significant shift).
- **significant**: Boolean (p < 0.05).
- **post_transition_cvle_lag**: Integer years until first CVLE, or None.

#### Export
- `transition_cvle_linkage.json`: Per-transition metrics.
- **Dashboard**: Table listing all transitions with p-values, deltas, and lags; highlights significant linkages.

---

## Viability Trend Analysis (M2)

### 25-Year Linear Regression
For each city, fit a linear model of CVLE risk probability over 25 years to quantify long-term viability trends.

#### Regression Specification
- **X**: Years (2000–2024), normalized or as integers.
- **Y**: RF-predicted CVLE probability (from baseline model).
- **Fit**: Ordinary least squares (OLS) per city.

#### Output Metrics
- **Slope**: Rise per year (positive = deteriorating, negative = improving).
- **R²**: Variance explained (0–1).
- **p_value**: Significance of slope (reject H0 if p < 0.05).
- **Trend label**:
  - "deteriorating" if slope > 0 and p < 0.05.
  - "improving" if slope < 0 and p < 0.05.
  - "stable" if p ≥ 0.05.

#### Export
- `viability_trend_report.json`: Per-city regression metrics and trend label.
- **Dashboard**: Bar chart of slopes sorted by magnitude; color-coded by trend type.

---

## Control City Validation

### Purpose
Validate that the pipeline does **not** flag control cities (Pune, Kolkata, Mumbai) as at-risk, confirming the model has not learned spurious patterns.

### Assertions
- **Trend check**: Trends in control cities should be "stable" (p ≥ 0.05 or |slope| small).
- **CVLE count**: Control cities should have zero CVLE events.
- **Transition count**: Control cities should have no detected Koppen transitions (or ≤ 1 non-persistent change).

### Rationale
- Pune (sorghum), Kolkata (rice/jute), Mumbai (rice) are expected to remain climatically viable through 2024.
- Any CVLE or significant deterioration in controls would indicate model overfit, mislabeling, or methodological error.

### Actions
- Print validation summary with warnings if controls fail checks.
- Proceed to dashboard/export with caveats noted.

---

## Dashboard & Visualization

### Interactive Panels (Dash/Plotly)

1. **Sowing Window Drift**: Time series of monsoon onset vs. optimal sowing DOY, annotated with Koppen transitions.
2. **Dual-Deficit Heatmap**: 10×25 grid (cities × years); red = dual-deficit active.
3. **CVLE Timeline**: Bar chart of CVLE count per city; control cities highlighted in gray.
4. **Transition→CVLE Linkage Table**: Tabular view of all transitions with p-values, deltas, and lags.
5. **Recharge Efficiency Trend**: Time series of groundwater recharge efficiency per city; declining trend indicates depleting aquifers.
6. **Koppen Zone History**: Scatter plot (year vs. city) colored by zone; helps spot transition patterns.
7. **SHAP Feature Importance**: Toggle between global and per-city views; bar charts of top contributors.
8. **Trend Report**: Bar chart of 25-year viability risk slopes; color-coded by trend label.

### Machine-Readable Outputs
All dashboard data is exported as JSON for external consumption:
- `transition_report.json`: All detected transitions.
- `crop_viability_events.json`: All CVLE instances with triggering features.
- `tft_attention_weights.json`: Per-city attention profiles.
- `shap_explanation.json`: Global and per-city SHAP importances.
- `transition_cvle_linkage.json`: Pre/post-transition CVLE risk with p-values and lags.
- `viability_trend_report.json`: 25-year regression slopes, R², p-values, trend labels.
- `groundwater_recharge_grid.json`: Recharge efficiency matrix (cities × years).

---

## Pipeline Orchestration & Reproducibility

### Step Sequence
1. **Step 0**: Master index creation.
2. **Step 0b**: Dataset preprocessing (humidity derivation, column standardization).
3. **Step 1**: Koppen classification (annual aggregates, zone encoding).
4. **Step 1b**: Transition detection (persistence confirmation, reporting).
5. **Step 2**: Climate feature engineering (GDD, monsoon onset, water deficit).
6. **Step 3**: Groundwater aggregation (spatial median, rates, recharge efficiency).
7. **Step 4**: GAEZ raster extraction (suitability class sampling, value clipping).
8. **Step 5**: Three-way join, compound features, CVLE labels.
9. **Step 6**: TFT training (checkpoint, early stopping, validation split).
10. **Step 7**: TFT prediction, attention extraction, event export.
11. **Step 8**: Baseline training (RF, LR, LSTM) and comparison metrics.
12. **Step 9**: SHAP explainability computation and JSON export.
13. **Step 10**: Causal linkage analysis (Wilcoxon tests, CVLE lag, transition reports).
14. **Step 11**: Trend regression (25-year slopes, R², p-values).
15. **Step 12**: Control city validation (assert Pune/Kolkata/Mumbai stability).
16. **Step 13**: Groundwater recharge grid export.
17. **Step 14**: Dashboard launch (Dash app on port 8050).

### Runner
- Top-level `run_vegshift.py` orchestrates the pipeline sequentially.
- Each step is standalone and reads/writes specific artifacts under `data/processed/` and `data/output/`.
- Early exit on failure to prevent cascading errors.

---

## Key Design Choices & Assumptions

### Koppen Simplification
- The pipeline uses a simplified Koppen logic (not a full global implementation) tuned for Indian cities and semi-arid/tropical regimes.
- Trade-off: Reduced accuracy on zone boundaries in temperate regions but sufficient for this domain.

### Groundwater Spatial Aggregation
- 50 km radius is a compromise between local relevance and data availability.
- Nearest-wells fallback is explicitly flagged to preserve provenance; Jaipur is the primary case affected.
- Pre-2005 imputation uses later-period baselines due to sparse CGWB historical coverage.

### GAEZ Raster Value Clipping
- Rasters encode both rainfed (1–7) and irrigated (8–10) suitability; the pipeline clips to rainfed scale for comparability with ECOCROP thresholds.
- This may understate irrigation potential but aligns with the rain-fed focus of most Indian smallholder crops tracked here.

### CVLE Labeling Conservatism
- Multi-year persistence (dual-deficit ≥ 2 years) + multi-threshold breach (≥ 2 of 3) reduces false positives.
- Trade-off: May miss transient or single-factor viability challenges.
- Thresholds (e.g., crop_water_deficit > 0.4) are domain-informed estimates; sensitivity analysis recommended for production use.

### TFT Architecture
- 5-year encoder window is driven by data sparsity (only 25 years total) and typical agricultural cycle lengths.
- 1-year horizon matches annual reporting cycles.
- Quantile loss enables calibrated probabilities but requires careful hyperparameter tuning.

### Missing Data Handling
- City-group mean imputation avoids information leakage across cities.
- All imputations are flagged (`gw_imputed`) for transparency.
- Imputation occurs post-join to minimize biasing any single dataset.

---

## Data Provenance & Quality Flags

### gw_imputed (Groundwater)
- **0**: Within 50 km radius; authoritative.
- **1**: Filled by city-group mean during imputation.
- **2**: Nearest-wells fallback (Jaipur); flagged for downstream caution.

### Humidity Derivation
- When RH is unavailable, it is derived via inversion and validated against climatological normals.
- Variance in Steadman formula coefficients exists; formula used here matches published literature.

### Raster Value Clipping (GAEZ)
- Some rasters encode values 8–10 (irrigated categories) beyond the standard 1–7 rainfed scale.
- Clipping to 7 is a deliberate choice to harmonize with ECOCROP thresholds; documented in step 4.

---

## Integration with SDGs

- **SDG 2 (Zero Hunger)**: VegShift identifies when and where crop viability fails, enabling proactive agricultural policy and research prioritization.
- **SDG 6 (Clean Water)**: Groundwater layer highlights aquifer depletion trends; critical for water-stressed regions like Rajasthan (Jaipur).
- **SDG 13 (Climate Action)**: Koppen transitions and trend analyses directly connect climate shifts to livelihood loss, supporting climate adaptation planning.

---

## Expected Outputs & Artifacts

### Data
- `vegshift_master.csv`: Master table (250 rows, ~30 columns) with all features, targets, and metadata.
- `koppen_annual.csv`: Annual Koppen zones per city.
- `climate_annual.csv`: Annual climate aggregates per city.
- `groundwater_annual.csv`: Annual groundwater metrics per city.
- `gaez_baseline.csv`: Static crop/ECOCROP thresholds per city.

### Models & Checkpoints
- `vegshift-tft-best.ckpt`: Best TFT model checkpoint (PyTorch Lightning).
- `rf_baseline.pkl`: Trained Random Forest model.
- `lr_baseline.pkl`: Trained Logistic Regression model.
- `lstm_baseline.pt`: Trained LSTM state dict.
- `scaler.pkl`: StandardScaler for feature normalization (used in RF/LR/LSTM).

### Reports & Explanations
- `transition_report.json`: All detected Koppen transitions.
- `crop_viability_events.json`: All CVLE instances with triggering features.
- `tft_attention_weights.json`: Per-city TFT attention weights.
- `shap_explanation.json`: Global and per-city SHAP feature importances.
- `transition_cvle_linkage.json`: Wilcoxon test results and CVLE lag per transition.
- `viability_trend_report.json`: 25-year regression slopes, R², p-values, trend labels per city.
- `groundwater_recharge_grid.json`: Annual recharge efficiency (cities × years).

### Visualization
- **Dash Dashboard** (localhost:8050): 8 interactive panels (sowing drift, dual-deficit, CVLE timeline, linkage table, recharge trends, Koppen history, SHAP importance, trend report).

---

## Validation & Quality Assurance

1. **Control cities**: Pune, Kolkata, Mumbai are asserted to remain stable (validate trend, CVLE count, transitions).
2. **Feature correlation**: Verify no unintended leakage between atmospheric and groundwater layers (low multicollinearity).
3. **Model agreement**: RF, LR, LSTM should qualitatively agree on at-risk vs. control cities (at high level).
4. **Causal linkage p-values**: Transitions with low p-values in Wilcoxon tests indicate robust CVLE shift; high p-values suggest spurious or weak linkage.
5. **Attention interpretation**: TFT attention should reflect meaningful historical patterns (e.g., recent years during rapid transitions, earlier baseline years for stable cities).

---

## End Notes

VegShift is a complete, reproducible pipeline integrating climate, groundwater, and agronomic data to quantify and explain crop viability loss events in Indian cities. The combination of Koppen transitions, compound dual-deficit indicators, CVLE labeling, TFT forecasting, and causal linkage analysis provides a rigorous, interpretable foundation for agricultural risk assessment and climate adaptation planning.
