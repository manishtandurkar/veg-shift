# VegShift: Detecting When Crops Die Due to Climate Change
## A Complete, Beginner-Friendly Technical Explanation

---

## Quick Summary

**The Problem:** India's climate is changing. Some cities are getting hotter and drier. When this happens, crops that have grown in those cities for decades stop being viable.

**What VegShift Does:** It detects the exact year when a city's climate shift causes a particular crop to become unviable. It answers: *When did this happen? Why did it happen?*

**The Answer:** A timestamped event like: *"Delhi: Wheat stopped being viable in 2018 due to extreme water shortage and failed monsoon onset."*

**Time Period:** 2000–2024 (25 years of data for 10 major Indian cities)

---

## Part 1: The Three Datasets Explained Simply

VegShift combines three independent sources of information. Think of it like a doctor diagnosing a patient:
- **Dataset 1:** The patient's vital signs (weather/temperature = atmospheric health)
- **Dataset 2:** The patient's blood tests (groundwater depth = water resource health)
- **Dataset 3:** The patient's medical history (crop requirements = what the crop needs to survive)

### Dataset 1: Daily Weather Data (Atmospheric Layer)

**What is it?**  
25 years of daily observations: temperature, rainfall, wind, humidity for 10 cities.

**Source:** `data/raw/climate/india_2000_2024_daily_weather.csv`  
**Size:** ~91,000 daily records (25 years × 365 days × 10 cities)

**Raw example:**
```
Date          City    Temp_Max  Temp_Min  Rainfall  Wind_Speed
2018-06-15    Delhi   42°C      28°C      15mm      5m/s
2018-06-16    Delhi   41°C      29°C      8mm       4m/s
```

**What we do with it:**

1. **Aggregate to yearly summaries** (turn 365 daily records into 1 yearly record per city)
2. **Classify climate zones** using the Köppen system: Is Delhi becoming more like a desert? A savanna?
3. **Calculate crop-specific metrics:**
   - **Growing Degree Days (GDD):** Temperature accumulation needed for a crop to mature. Wheat needs ~1200 GDD/year; if the year only gives 800 GDD, wheat won't mature.
   - **Monsoon onset:** When does the rainy season start? If it starts late, farmers miss the planting window.
   - **Water deficit:** How much rain did the crop need vs. how much it actually got?

**Preprocessing note:** The raw data has no humidity column. We derived it using a physics-based formula (Steadman's apparent temperature inversion) and validated it against known city averages (Mumbai ~90%, Jaipur ~65%).

<img width="869" height="344" alt="image" src="https://github.com/user-attachments/assets/33f5d088-baa8-4cb7-8166-953c5fb16402" />


---

### Dataset 2: Groundwater Levels (Subsurface Layer)

**What is it?**  
Depth measurements of water tables in observation wells across India, taken 4 times per year (Jan, May, Aug, Nov) from 2000–2022.

**Source:** Central Groundwater Board (CGWB) — India's official water agency  
**Unit:** Metres Below Ground Level (mbgl). Higher = water table is deeper = aquifer is depleted.

**Raw example:**
```
Well_Location    Jan_2000  May_2000  Aug_2000  Nov_2000
Delhi_Well_7     15 mbgl   18 mbgl   12 mbgl   14 mbgl
Delhi_Well_8     16 mbgl   19 mbgl   13 mbgl   15 mbgl
```

**Interpretation:**
- Jan (start of year): 15 m deep
- May (pre-monsoon/dry): 18 m deep (water table dropped 3 m)
- Aug (monsoon): 12 m deep (water table rose 6 m from rainfall recharge)
- Nov (post-monsoon): 14 m deep (some water was used up)

**What we do with it:**

1. **Aggregate spatially** (all wells within 50 km of a city — take the median depth)
2. **Track depletion rate** (year-over-year change: is the water table dropping?)
3. **Measure recharge efficiency** (after monsoon, how much did the level recover per mm of rainfall?)
4. **Combine with climate** (if rainfall is low AND the aquifer isn't recovering, that's a "dual deficit")

**Special cases and data quality:**
- **Jaipur:** Rajasthan state is missing from CGWB entirely. We use the 5 nearest wells from other states as a fallback, flagged as `gw_imputed=2`.
- **Kolkata:** Wells near Kolkata only have November (post-monsoon) readings; no May (pre-monsoon) readings exist in the dataset. City-mean imputation fails (mean of all-NaN = NaN), so we fall back to the global median across all cities.
- **Years 2023–2024:** CGWB dataset ends in 2022. Years beyond that have no groundwater records and are marked `gw_imputed=1` (backfill).
- **Pre-2005:** Data is sparse. Missing years are backfilled using the average depletion rate from 2005–2007 for that city.

---

### Dataset 3: Crop Suitability Maps (FAO GAEZ)

**What is it?**  
Geospatial maps (GeoTIFFs) from the UN Food and Agriculture Organization showing which crops grow best where.

**Source:** FAO GAEZ v4 database, based on 1981–2010 climate baseline  
**Resolution:** ~9 km grid cells across India  
**Coverage:** 53 crops; we use 6 (wheat, cotton, rice, sugarcane, mustard, ragi/groundnut)

**Suitability scale (1–7):**
- 1 = Not suitable
- 4 = Moderately suitable
- 7 = Very suitable (optimal)

**Example extraction at city coordinates:**
```
City        Crop        Baseline_Suitability
Delhi       Wheat       6 (very suitable)
Jaipur      Mustard     5 (suitable)
Chennai     Rice        6 (very suitable)
```

**Crop requirements (ECOCROP thresholds):**

| Crop      | GDD_Min | Water_Req | Max_Temp |
|-----------|---------|-----------|----------|
| Wheat     | 1200    | 450 mm    | 35°C     |
| Cotton    | 1800    | 700 mm    | 40°C     |
| Sugarcane | 2500    | 1500 mm   | 38°C     |
| Rice      | 2000    | 1200 mm   | 38°C     |

**What we do with it:**  
Compare observed climate against these thresholds. If Delhi's observed GDD < 1200, wheat viability is threatened.

---

## Part 2: Key Concepts You Need to Know

### What is the Köppen Climate Classification?

Köppen is a system that labels Earth's climates with short codes. Think of it like blood types for climate.

**Examples:**
- **Am** = Tropical monsoon (hot, wet, seasonal rain) → Mumbai, Kolkata, coastal India
- **Aw** = Tropical savanna (hot, seasonal rain, pronounced dry season) → Bangalore, Chennai
- **BSh** = Semi-arid hot (hot, dry, borderline desert) → Jaipur, Delhi, Hyderabad
- **BWh** = Arid hot (desert) → hyper-dry regions
- **Cwa** = Humid subtropical (cold winter, hot summer) → Lucknow

**Why it matters:**  
Different crops thrive in different climate zones. If a city's zone shifts (e.g., tropical → semi-arid), its crops may no longer be suitable.

**How we classify:**
```python
if annual_rainfall < aridity_threshold:
    if annual_rainfall < 0.5 * aridity_threshold:
        zone = "Desert (BW)"
    else:
        zone = "Semi-arid (BS)"
elif temperature_coldest_month >= 18:
    zone = "Tropical (A)"
elif temperature_coldest_month >= 0:
    zone = "Temperate (C)"
```

### What is a Crop Viability Loss Event (CVLE)?

A **CVLE** is a formally detected event marking when a crop stops being viable for a city.

**Trigger conditions (ALL must be true):**

1. **Dual-deficit persistence:** For 2+ consecutive years, BOTH:
   - Atmospheric water deficit > 40% (insufficient rainfall)
   - Groundwater recharge efficiency < 30% (aquifer isn't recovering)

2. **Multi-threshold breach in the current year:** At least 2 of these 3 must be true:
   - Sowing window missed by >60% (monsoon too late)
   - Crop water deficit > 40% (too dry)
   - Growing Degree Days insufficient (too cold)

**Why this design?**
- **Persistence** filters out single-year bad luck; only multi-year stress counts
- **Multi-threshold** ensures multiple systems fail simultaneously, not just one bad season
- **Conservative** approach reduces false alarms

**Example CVLE:**
```
Year 2018 (Delhi, Wheat):
  Dual-deficit: Yes (2017 and 2018 both had it)
  Sowing window miss: 65%  --> threshold 1 breached
  Water deficit: 45%       --> threshold 2 breached
  GDD adequate: No         --> threshold 3 breached (bonus)

  Result: CVLE triggered for Delhi wheat in 2018
```

### What is the "Dual Deficit"?

The dual deficit is when both atmospheric water (rainfall) AND subsurface water (groundwater) fail simultaneously.

**Think of it like this:**  
A farmer has two water sources: rainfall (sky) and wells (ground). If rainfall is low, the farmer pumps from wells. If BOTH fail at once, there is no backup — severe crisis.

**Detection:**
```
dual_deficit = (crop_water_deficit > 0.4) AND (recharge_efficiency < 0.30)
```

---

## Part 3: The 17-Step Pipeline

A **pipeline** is a series of scripts that run sequentially. Each step reads inputs, processes them, and writes outputs that the next step uses.

```
Raw Data
   |
Step 0-4:  Data Processing and Aggregation
   |
Step 5:    Merge all data + Create CVLE labels
   |
Step 6-9:  Train ML Models and Explain them
   |
Step 10-13: Analyze results + Generate reports
   |
Step 15-17: Crop Advisory + Irrigation Strategy + Exploitation Risk
   |
Step 14:   Build interactive dashboard (launches in background)
```

---

### Phase 1: Data Collection and Standardization (Steps 0–4)

#### Step 0: Master Index
**Input:** Nothing (just city and year definitions)  
**Output:** `data/processed/master_index.csv` (250 rows)

Creates the backbone table: 10 cities × 25 years = 250 city-year combinations. This is the join key that everything else attaches to.

```
city         year
Delhi        2000
Delhi        2001
...
Pune         2024
```

---

#### Step 0b: Preprocess Datasets
**Input:** Raw CSV files  
**Output:** `data/processed/kaggle_climate.csv`

Cleans and standardizes the raw climate data:
- Rename messy column names to standard ones
- Convert units (wind speed: km/h → m/s)
- Derive missing fields (humidity from apparent temperature)
- Validate against known ranges

```python
# Wind speed conversion
wind_ms = wind_kmh / 3.6

# Humidity from Steadman apparent-temperature inversion
e  = (AT_mean - T_mean + 0.70 * wind_ms + 4.00) / 0.33
es = 6.1078 * exp(17.27 * T_mean / (237.3 + T_mean))
RH = clip((e / es) * 100, 5, 100)
```

---

#### Step 1: Köppen Classification
**Input:** Daily climate data  
**Output:** `data/processed/koppen_annual.csv` (250 rows)

For each city-year, computes annual climate summary and classifies into Köppen zone.

**Output example:**
```
city      year  koppen_zone  T_ann   P_ann
Delhi     2000  Cwa          24.5    680
Delhi     2004  BSh          26.8    640
```

---

#### Step 1b: Transition Detection
**Input:** `koppen_annual.csv`  
**Output:** `data/output/transition_report.json`

Detects persistent climate zone transitions. A transition only counts if the new zone holds for 3+ consecutive years (filters single-year noise).

**Algorithm:**
```
Zones over time: Cwa, Cwa, Cwa, BSh, BSh, BSh, BSh
Years:          2000 2001 2002 2003 2004 2005 2006

Transition detected: 2003 (Cwa -> BSh, confirmed 3 years 2003-2005)
```

**Output:**
```json
{
  "city": "Delhi",
  "transition_year": 2003,
  "from_zone": "Cwa",
  "to_zone": "BSh",
  "years_confirmed": 3
}
```

---

#### Step 2: Climate Feature Aggregation
**Input:** Daily climate data  
**Output:** `data/processed/climate_annual.csv` (250 rows, 12 features)

Converts daily weather into annual crop-relevant features.

| Feature | How | Why |
|---------|-----|-----|
| `temp_mean` | Annual average | Baseline warmth |
| `rainfall_annual` | Sum of daily rain | Total water availability |
| `n_dry_months` | Months with <60 mm rain | Drought severity |
| `monsoon_onset_doy` | Day-of-year monsoon starts | Timing of planting window |
| `sowing_window_miss` | % delay past optimal sowing date | Planting delay penalty |
| `gdd_accumulation` | Sum of (T - base)° over Apr–Sep | Heat available for crop growth |
| `crop_water_deficit` | (needed rain - actual rain) / needed | Water shortage fraction |

---

#### Step 3: Groundwater Aggregation
**Input:** CGWB well data  
**Output:** `data/processed/groundwater_annual.csv` (250 rows, 6 features)

Aggregates point well measurements into city-level metrics:
1. Find all wells within 50 km of each city (Haversine distance)
2. Take median depth per year (pre- and post-monsoon)
3. Calculate depletion rate (year-over-year depth change) and recharge efficiency

**Jaipur special case:** Rajasthan absent from CGWB → use 5 nearest wells from other states, flagged `gw_imputed=2`.

---

#### Step 4: FAO GAEZ Extraction
**Input:** GeoTIFF rasters  
**Output:** `data/processed/gaez_baseline.csv` (10 rows, one per city)

Extracts suitability class for each city's primary crop from raster maps. Attaches ECOCROP thresholds (GDD min, water requirement, etc.). Values above 7 (irrigated potential) are clipped to 7.

---

### Phase 2: Data Integration and Labeling (Step 5)

#### Step 5: Three-Way Join + CVLE Labels
**Input:** Master index + climate + groundwater + GAEZ + Köppen  
**Output:** `data/processed/vegshift_master.csv` (250 rows, ~30 columns)

This is the master dataset combining everything.

**Imputation strategy (two-pass):**
1. Fill missing GW values with city-group mean
2. If still NaN (entire city has no readings, e.g., Kolkata pre-monsoon), fill with global median across all cities

```python
for col in ['pre_monsoon_depth_mbgl', ...]:
    df[col] = df.groupby('city')[col].transform(lambda x: x.fillna(x.mean()))
    global_median = df[col].median()
    df[col] = df[col].fillna(global_median)
```

Years 2023–2024 (beyond CGWB range) are marked `gw_imputed=1`.

**Compound features computed:**
```python
dual_deficit = (crop_water_deficit > 0.4) AND (recharge_efficiency < 0.30)
gdd_adequate = (gdd_accumulation >= crop_gdd_min)
```

**CVLE label logic:**
```python
def compute_cvle(group):
    for each year i from the second year onwards:
        consec = dual_deficit[i] == 1 AND dual_deficit[i-1] == 1
        t1 = sowing_window_miss[i] > 0.6
        t2 = crop_water_deficit[i] > 0.4
        t3 = gdd_adequate[i] == 0
        if consec AND (t1 + t2 + t3) >= 2:
            cvle_label[i] = 1
```

**Output:** 250 rows, 0 NaN in any key column, CVLE labels assigned per city-year.

---

### Phase 3: Machine Learning (Steps 6–9)

#### Step 6: Train Temporal Fusion Transformer (TFT)
**Input:** `vegshift_master.csv`  
**Output:** `data/output/vegshift-tft-best.ckpt`

TFT is a deep learning model designed for time series forecasting with multiple feature types.

**Architecture:**
- **Lookback:** 5 years (encoder sees the last 5 years)
- **Horizon:** 1 year (decoder predicts next year's CVLE risk)
- **Features:** 17 time-varying inputs + 2 static categoricals + 5 static reals
- **Output:** 7 quantile predictions for CVLE probability (10th–90th percentile)

**Why TFT?**
- Handles mixed feature types (categorical, numerical, temporal)
- Attention mechanism shows which past years drove predictions
- Probabilistic output (risk scores, not hard classifications)
- Designed for small datasets with temporal structure

**Training split:**
- Train: years 0–18 (2000–2018)
- Validation: years 0–21 (2000–2021)
- Early stopping on validation loss

---

#### Step 7: TFT Prediction + Attention Extraction
**Input:** Best TFT checkpoint + all data  
**Output:** `data/output/tft_predictions.csv`, `data/output/tft_attention_weights.json`

Runs the trained model to get:
1. Predicted CVLE probabilities for each city-year
2. Attention weights showing which past years mattered most

**Attention interpretation:**  
"To predict 2020's CVLE probability, the model paid 40% attention to 2019, 30% to 2018, 20% to 2017..."

---

#### Step 8: Train Baseline Models
**Input:** `vegshift_master.csv`  
**Output:** `data/output/rf_baseline.pkl`, `lr_baseline.pkl`, `scaler.pkl`, `lstm_baseline.pt`, `baseline_metrics.json`

Trains three comparison models:

1. **Random Forest:** Decision tree ensemble; non-temporal; fast; used by steps 9–11
2. **Logistic Regression:** Linear classifier; most interpretable
3. **LSTM:** Recurrent neural network; temporal baseline for TFT comparison

These provide sanity checks: do all models agree on at-risk cities? Is TFT's complexity justified?

---

#### Step 9: SHAP Explainability
**Input:** Random Forest model + test data  
**Output:** `data/output/shap_explanation.json`

Computes SHAP (SHapley Additive exPlanations) values using TreeExplainer.

**What it shows:**
- **Global importance:** Which features matter most across all predictions?  
  e.g., `crop_water_deficit` (35%), `depletion_rate` (28%), `dual_deficit` (22%)
- **Per-city importance:** Which features drive predictions for each specific city?  
  Delhi: sowing_window_miss, monsoon_onset_doy  
  Jaipur: crop_water_deficit, rainfall_annual

**Why SHAP?** Mathematically grounded in game theory; more accurate than permutation importance.

---

### Phase 4: Analysis and Validation (Steps 10–13)

#### Step 10: Causal Linkage Analysis
**Input:** `vegshift_master.csv` + `transition_report.json`  
**Output:** `data/output/transition_cvle_linkage.json`

**Question:** Does a Koppen zone transition cause elevated CVLE risk afterwards?

**Method:**  
For each detected transition (e.g., Delhi 2003: Cwa → BSh):
1. Compute average CVLE probability in the 3 years before the transition (pre-risk)
2. Compute average CVLE probability in the 3 years after (post-risk)
3. Run a **Wilcoxon signed-rank test** to check if the increase is statistically significant
4. Measure CVLE lag: how many years after transition did the first CVLE occur?

**Output example:**
```json
{
  "city": "Delhi",
  "transition_year": 2003,
  "pre_risk_mean": 0.12,
  "post_risk_mean": 0.45,
  "risk_delta": 0.33,
  "p_value": 0.032,
  "significant": true,
  "cvle_lag_years": 2
}
```

**Interpretation:** Delhi's CVLE risk jumped 33 percentage points after the 2003 transition (p=0.032 = significant), with the first CVLE appearing 2 years later.

---

#### Step 11: Viability Trend Regression
**Input:** `vegshift_master.csv` + `data/output/rf_baseline.pkl` + `data/output/scaler.pkl`  
**Output:** `data/output/viability_trend_report.json`

**Question:** Are crops getting steadily less viable over 25 years?

**Method:**
1. Run Random Forest `predict_proba` on all 250 rows → `viability_risk_prob` per city-year
2. For each city, fit linear regression: X = year, Y = viability risk probability
3. Label trend based on slope significance:
   - `deteriorating` — slope > 0 and p < 0.05
   - `improving` — slope < 0 and p < 0.05
   - `stable` — p >= 0.05

**Output example:**
```json
{
  "city": "Delhi",
  "slope": 0.0045,
  "r_squared": 0.62,
  "p_value": 0.008,
  "trend": "deteriorating"
}
```

**Interpretation:** Delhi's CVLE risk increases by 0.45% per year over 2000–2024 (statistically significant).

---

#### Step 12: Control City Validation
**Input:** `viability_trend_report.json` + `transition_report.json` + `crop_viability_events.json`  
**Output:** Printed validation report

**Purpose:** Ensure the model isn't detecting noise.

**Control cities:** Pune, Kolkata, Mumbai  
**Expected:** stable trends, 0 CVLEs, 0 Koppen transitions

**Three checks:**
1. Trend check — must be "stable" (p >= 0.05)
2. CVLE count — must be 0
3. Transition count — must be 0

If any control city fails, the pipeline has a labeling or modeling problem.

**At-risk city summary** is also printed (transitions, CVLEs, slope) for quick comparison.

---

#### Step 13: Recharge Grid Export
**Input:** `vegshift_master.csv`  
**Output:** `data/output/groundwater_recharge_grid.json`

Simple pivot of recharge efficiency into a nested JSON for the dashboard.

```json
{
  "Delhi": {"2000": 0.008, "2001": 0.007, "2002": 0.006, ...},
  "Jaipur": {"2000": 0.005, "2001": 0.004, "2002": 0.003, ...}
}
```

This lets the dashboard show per-city aquifer health trends over time.

---

### Phase 5: Advisory Engines (Steps 15–17)

#### Step 15: Crop Advisory Engine
**Input:** `vegshift_master.csv`, `viability_trend_report.json`
**Output:** `data/output/crop_advisory.json`

Scores all 14 Indian crops (wheat, mustard, rice, cotton, sugarcane, groundnut, sorghum, ragi, chickpea, lentil, maize, sunflower, bajra, barley) for each city on five axes — zone compatibility (30 pts), temperature stress (20 pts), rainfall adequacy (20 pts), groundwater stress (15 pts), and a 5-year climate **trajectory penalty** (15 pts). The trajectory penalty is the key innovation: a crop that is borderline viable now but whose climate fit is narrowing scores lower than a drought-tolerant alternative that is gaining headroom. Results are sorted descending per city.

---

#### Step 16: Irrigation Strategy Engine
**Input:** `vegshift_master.csv`, `kaggle_climate.csv`, `crop_advisory.json`
**Output:** `data/output/irrigation_strategy.json`

Classifies each city into one of four **Recharge Stress Index (RSI)** levels based on `recharge_efficiency` (computed as `depth_recovery_m / rainfall_annual_mm`) and `pre_monsoon_depth_mbgl`:

| RSI Level | Condition | Method Prescribed |
|-----------|-----------|------------------|
| Critical | efficiency < 0.002 OR depth > 20 mbgl | Drip only |
| Stressed | efficiency < 0.004 OR depth > 12 mbgl | Drip or sprinkler + rainwater harvesting |
| Moderate | efficiency < 0.006 | Sprinkler recommended |
| Healthy | otherwise | Conventional acceptable |

Also derives the optimal kharif sowing window from peak monthly rainfall and links each city to applicable government schemes (PMKSY, PM-KUSUM, MGNREGS, RKVY, PMFBY).

---

#### Step 17: Exploitation Risk Engine
**Input:** `vegshift_master.csv`, `viability_trend_report.json`, `transition_cvle_linkage.json`, `crop_advisory.json`
**Output:** `data/output/exploitation_risk_report.json`

Computes an **Exploitation Risk Index (ERI)** — a weighted composite of five climate-derived signals:

| Component | Weight |
|-----------|--------|
| CVLE probability (5-yr rolling mean) | 0.30 |
| Drought risk (latest year crop_water_deficit) | 0.25 |
| Groundwater stress (depth / 25 mbgl ceiling) | 0.20 |
| Viability trajectory risk (slope from Step 11) | 0.15 |
| Climate transition risk (worst risk_delta from Step 10) | 0.10 |

When ERI ≥ 0.65, an alert is triggered with the MSP (Minimum Support Price 2024-25), distress price threshold (80% of MSP), alternative crops, and state procurement centre URL.

---

### Phase 6: Visualization (Step 14)

#### Step 14: Interactive Dashboard
**Output:** Web app at `http://localhost:8050`

Built with Plotly Dash. Eleven interactive panels. Launched automatically in the background by `run_vegshift.py` after all analysis steps complete.

1. **Sowing Window Drift** — monsoon onset day vs. optimal sowing date per city, with transition year markers
2. **Dual-Deficit Heatmap** — city × year grid (red = both systems failed that year)
3. **CVLE Timeline** — bar chart of CVLE events per city (control cities in gray)
4. **Transition → CVLE Linkage** — table of all transitions, Wilcoxon p-value, risk delta, CVLE lag
5. **Recharge Efficiency Trend** — groundwater recovery declining over time (falling = aquifer damage)
6. **Köppen Zone History** — zone label per city per year as a scatter/timeline plot
7. **SHAP Feature Importance** — bar charts of global and per-city feature contributions
8. **Trend Report** — 25-year viability risk slope per city, color-coded by trend
9. **Crop Advisory** — top-ranked crops per city scored on zone fit, temperature, rainfall, GW stress, and trajectory
10. **Irrigation Strategy** — groundwater depth per city with RSI level colour coding and recommended method
11. **Exploitation Risk** — stacked ERI component bar chart per city with alert threshold line

All charts are interactive: hover for values, filter by city.

To launch the dashboard standalone:
```bash
python pipeline/step14_dashboard.py
```

Then open `http://localhost:8050` in your browser.

---

## Part 4: Data Quality and Special Cases

### Missing Data Handling

| Issue | Cause | Fix |
|---|---|---|
| Humidity missing | Raw dataset has no humidity column | Derived via Steadman apparent-temperature inversion, validated against climatological norms |
| Pre-2005 groundwater sparse | CGWB coverage poor before 2005 | Backfilled using 2005–2007 average depletion rate per city |
| Jaipur groundwater missing | Rajasthan absent from CGWB dataset | Use 5 nearest wells from other states; flag `gw_imputed=2` |
| Kolkata pre-monsoon GW all-NaN | Wells near Kolkata have no May readings in the dataset | Fall back to global median across all cities after city-mean imputation fails |
| Years 2023–2024 GW missing | CGWB dataset ends at 2022 | Mark as `gw_imputed=1`; GW columns filled by city mean / global median in step5 |

### Data Provenance Flags (`gw_imputed`)

- `0` — Well within 50 km radius (authoritative measurement)
- `1` — Filled by mean imputation (no well in range, or year beyond CGWB range)
- `2` — Nearest-wells fallback from another state (Jaipur only)

### Known Limitations

1. **GAEZ raster encoding:** Some values 8–10 represent irrigated potential; clipped to 7 for rainfed consistency
2. **Jaipur:** Groundwater data extrapolated from other states — treat with caution
3. **Pre-2005:** Climate well-measured; groundwater sparse — results less confident
4. **CVLE conservatism:** Multi-year persistence + multi-threshold design deliberately reduces sensitivity; some real loss events may not be flagged

---

## Part 5: Key Outputs Explained

| Output File | What It Contains | Example |
|---|---|---|
| `transition_report.json` | All detected persistent Koppen transitions | Delhi: Cwa → BSh in 2003 |
| `crop_viability_events.json` | All detected CVLE events (timestamped) | Delhi wheat: CVLE in 2018 |
| `transition_cvle_linkage.json` | Pre/post-transition CVLE risk with Wilcoxon test | Delhi 2003: risk 12% → 45%, p=0.032 |
| `viability_trend_report.json` | 25-year slope of CVLE risk per city | Delhi: slope=+0.0045/yr (deteriorating) |
| `shap_explanation.json` | SHAP feature importances (global + per city) | crop_water_deficit: 35% global weight |
| `tft_attention_weights.json` | Which past years the TFT model weighted | Delhi 2020: last year 40%, year-2: 30% |
| `groundwater_recharge_grid.json` | Annual recharge efficiency for all cities | Delhi 2020: 0.008 |
| `baseline_metrics.json` | RF / LR / LSTM test-set accuracy | RF: 0.87 F1, LR: 0.79 F1 |
| `crop_advisory.json` | 14-crop ranked suitability scores per city with 5-yr trajectory penalty | Ahmedabad top crop: cotton (97.8) |
| `irrigation_strategy.json` | RSI level, irrigation method, avoid-crops, sowing window, govt schemes | Delhi: critical, drip only |
| `exploitation_risk_report.json` | ERI score, alert, MSP, distress threshold, alt crops, procurement links | Chennai ERI=0.21 (OK) |

---

## Part 6: From Data to Insight — A Complete Example

Let's walk through Delhi wheat from start to finish.

### Steps 0–4: Raw Data → Features

**Step 0:** Create master index → Delhi appears 25 times (2000–2024)

**Steps 1–2:** Classify Köppen + compute climate features
```
Year  Temperature  Rainfall  Koppen  GDD   Water_Deficit
2000  24.5C        680 mm    Cwa     1250  0.05
2003  26.8C        640 mm    BSh     900   0.15  <- Zone shifted
2010  27.2C        620 mm    BSh     750   0.30
2018  28.1C        500 mm    BSh     600   0.45  <- Water crisis
```

**Step 3:** Groundwater aggregate
```
Year  Pre_Monsoon_Depth  Recharge_Eff  Depletion_Rate
2000  15 m               0.010         --
2003  17 m               0.008         +2 m (depleting)
2018  25 m               0.005         +1.5 m/year
```

### Step 5: Combine + Label

`vegshift_master.csv` row for Delhi 2018:
```
city="Delhi", year=2018, crop="wheat",
gdd_accum=600, water_deficit=0.45, recharge_eff=0.005,
gdd_min=1200, sow_window_miss=0.65,
dual_deficit=1  (0.45>0.4 AND 0.005<0.30)
gdd_adequate=0  (600 < 1200)

-> CVLE_label = 1 (dual_deficit 2+ years + 2-of-3 thresholds breached)
```

### Steps 6–9: Train Models

TFT learns: "When dual-deficit persists + GDD fails + sowing window misses → CVLE"

SHAP analysis finds: "For Delhi, water_deficit (35%) and monsoon_onset (30%) drive CVLE most"

### Steps 10–11: Analyze

**Linkage (step 10):** Delhi's 2003 transition (Cwa → BSh):
- CVLE risk: 12% (pre) → 45% (post), p=0.032 — significant
- First CVLE: 2018 (lag = 15 years from transition)

**Trend (step 11):** Delhi's viability slope = +0.0045/year (p=0.008) = "deteriorating"

### Step 12: Validate

Pune, Kolkata, Mumbai all pass: stable trends, 0 CVLEs, 0 transitions.

### Step 14: Dashboard

Visualize:
- Sowing window drift (monsoon getting later in Delhi)
- Dual-deficit years (red heatmap shows 2017–2019 all hit)
- CVLE timeline (Delhi = 1 event in 2018)
- Recharge trend (well depth deepening 1–2 m/year)

---

## Part 7: Why This Approach?

### Why 3 Datasets?

- **Climate alone:** Tells us temperature/rainfall but not sustainable water
- **Groundwater alone:** Shows depletion but not immediate climate stress
- **Together:** Comprehensive picture — both short-term weather and long-term aquifer health

### Why Dual-Deficit?

Single-factor thresholds (e.g., "rainfall < X") produce too many false positives. Dual-deficit ensures both atmospheric and subsurface systems fail simultaneously, indicating a real crisis not survivable by switching water sources.

### Why Temporal Models (TFT, LSTM)?

Crops respond to multi-year patterns, not single-year anomalies. Temporal models capture this; static models don't.

### Why Transitions → CVLE Linkage?

Proves the causal story: climate shift → crop loss. Without linkage analysis, correlation and causation are indistinguishable.

### Why Control Cities?

If Pune/Kolkata/Mumbai show deterioration, the labels are wrong. Controls validate the entire pipeline is detecting real signal, not noise.

---

## Part 8: Technical Stack

| Component | Technology | Why |
|---|---|---|
| Data processing | Pandas, NumPy | Standard tabular manipulation |
| Spatial (wells) | Haversine formula | Compute distances without external GIS libs |
| Geospatial (rasters) | Rasterio | Read GeoTIFF suitability maps |
| Statistics | SciPy | Wilcoxon test, linear regression |
| ML models | Scikit-learn (RF, LR) | Fast, interpretable tree/linear models |
| Deep learning | PyTorch + PyTorch Lightning | TFT, LSTM implementations |
| Time series | PyTorch Forecasting | Specialized TFT library |
| Explainability | SHAP | Industry-standard TreeExplainer |
| Visualization | Plotly + Dash | Interactive 11-panel research dashboard |
| API layer | FastAPI + Uvicorn | REST endpoints serving precomputed outputs |
| Frontend | React 18 + Vite | 8-page decision-first farmer UI |
| Multilingual UI | Custom i18n module | English, Hindi, and Kannada translations; language preference persisted in localStorage |
| AI Coach | Rule-based logic + optional OpenAI GPT-4o-mini | Per-city farming action plan in the Dashboard; falls back to rule-based steps if `OPENAI_API_KEY` is not set |
| Chatbot | TF-IDF (scikit-learn) | Knowledge-base retrieval over docs + outputs |
| Orchestration | Python subprocess | Sequential step execution |
| Testing | pytest | 30 tests covering all pipeline stages |

---

## Part 9: Running and Testing

### Run the full pipeline

```bash
python run_vegshift.py
```

### See what steps exist without running them

```bash
python run_vegshift.py --dry-run
```

### Run individual steps

```bash
python pipeline/step0_master_index.py
python pipeline/step5_join_and_features.py
# ... etc.
```

### Run all tests

```bash
pytest tests/
```

Tests cover: runner file structure, step count, dry-run exit, dataset presence, output files, model files, data integrity (250 rows, 10 cities, 0 NaN in key columns).

---

### Run the product web app

After the pipeline completes, build the frontend payload and start both servers:

```bash
python tools/build_frontend_payload.py   # assembles data/output/frontend_payload.json
uvicorn api.app:app --reload --port 8000  # FastAPI backend
cd web && npm install && npm run dev      # React frontend at localhost:5173
```

The web app has eight pages:

| Route | What you see |
|---|---|
| `/` | Landing — project overview, live risk meters for all 10 cities |
| `/intake` | Farmer profile form (name, city, land size, crop) |
| `/dashboard` | ERI gauge, risk meter, advisory cards, trend strip, AI Coach action steps (rule-based or LLM) — gated until intake is submitted |
| `/crops` | 14-crop ranked suitability table with trajectory penalty scores |
| `/water` | RSI level, irrigation method, recharge trend, government schemes |
| `/economic` | ERI component breakdown, MSP alert, distress threshold, procurement links |
| `/explain` | SHAP feature importance (mean absolute value, neutral coloring) and TFT attention weights |
| `/reports` | Full city report with all outputs in one view |

A **persistent AI chatbot** sits in the bottom-right corner of every page. It uses a TF-IDF knowledge base built from all `docs/` markdown files and key `data/output/` JSON files. Each response includes source attribution badges so you can trace the answer back to the exact document or pipeline output it came from.

The **AI Coach** (Dashboard `ActionSteps` panel) is a separate feature: it calls the `/coach` API endpoint to produce a 5–7 step personalized farming action plan. It uses a rule-based engine by default; if `OPENAI_API_KEY` is set, it calls GPT-4o-mini for richer, context-aware steps.

The entire UI supports **three languages**: English, Hindi (हिन्दी), and Kannada (ಕನ್ನಡ), switchable via a dropdown in the navbar. Language preference is saved in `localStorage`.

---

## Summary

VegShift combines three datasets (climate, groundwater, crop requirements) to detect when crops become unviable after climate zone shifts in Indian cities.

**The 17-step pipeline:**
1. Standardizes and preprocesses data (Steps 0–4)
2. Merges into master table + creates CVLE labels (Step 5)
3. Trains ML models: TFT + RF + LR + LSTM (Steps 6–9)
4. Analyzes and validates findings (Steps 10–13)
5. Generates forward-looking advisory outputs (Steps 15–17)
6. Visualizes all outputs in an 11-panel interactive dashboard (Step 14)

**Key innovations:**
- Dual-deficit indicator: simultaneous atmospheric + subsurface failure
- CVLE: formally timestamped crop viability loss events
- Causal linkage analysis: Wilcoxon test proving transition → viability loss
- Multi-model ensemble: TFT primary, RF/LR/LSTM for validation
- Control city validation: Pune/Kolkata/Mumbai prove model is not spurious
- SHAP + TFT attention: full explainability at feature and temporal level

**Output:** Timestamped Crop Viability Loss Events with full causal and feature-level explanations, an 11-panel interactive Dash dashboard, and a product-grade React web app with AI chatbot.

---

## Glossary

- **CVLE:** Crop Viability Loss Event — when a crop becomes unviable for a city
- **Koppen:** Climate classification system (Cwa, BSh, Am, etc.)
- **GDD:** Growing Degree Days — heat accumulation needed for crop maturation
- **Dual-deficit:** Simultaneous atmospheric (low rainfall) + subsurface (low recharge) failure
- **Monsoon onset:** Day-of-year when rainy season begins
- **Recharge efficiency:** Water level recovery / Annual rainfall
- **RSI:** Recharge Stress Index — four-level classification (Critical / Stressed / Moderate / Healthy) used to prescribe irrigation method per city
- **ERI:** Exploitation Risk Index — weighted composite of CVLE probability, drought risk, groundwater stress, viability trajectory, and transition risk; triggers MSP alert at ≥ 0.65
- **MSP:** Minimum Support Price — government-guaranteed floor price for a crop
- **SHAP:** SHapley Additive exPlanations — feature importance method from game theory
- **TFT:** Temporal Fusion Transformer — deep learning time series model with attention
- **LSTM:** Long Short-Term Memory — recurrent neural network for sequences
- **TF-IDF:** Term Frequency–Inverse Document Frequency — text similarity method used by the chatbot to retrieve relevant documents
- **Wilcoxon test:** Non-parametric statistical test for paired comparisons (pre vs. post)
- **Pipeline:** Sequential data processing workflow where each step feeds the next
