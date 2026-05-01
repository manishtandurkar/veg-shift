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
Date          City    Temp_Max  Temp_Min  Rainfall  Wind_Speed  Humidity
2018-06-15    Delhi   42°C      28°C      15mm      5m/s        55%
2018-06-16    Delhi   41°C      29°C      8mm       4m/s        58%
```

**What we do with it:**

1. **Aggregate to yearly summaries** (turn 365 daily records into 1 yearly record per city)
2. **Classify climate zones** using the Köppen system: Is Delhi becoming more like a desert? A savanna? (More on this below)
3. **Calculate crop-specific metrics:**
   - **Growing Degree Days (GDD):** Temperature accumulation needed for a crop to mature. Wheat needs ~1200 GDD/year; if the year only gives 800 GDD, wheat won't mature.
   - **Monsoon onset:** When does the rainy season start? If it starts late, farmers miss the planting window.
   - **Water deficit:** How much rain did the crop need vs. how much it actually got?

**Preprocessing note:** The raw data didn't include humidity directly. We derived it using a physics-based formula (Steadman's apparent temperature inversion) and validated it against known city-averages (Mumbai ~90%, Jaipur ~65%).

---

### Dataset 2: Groundwater Levels (Subsurface Layer)

**What is it?**  
Depth measurements of water tables in observation wells across India, taken 4 times per year (Jan, May, Aug, Nov) from 2000–2022.

**Source:** Central Groundwater Board (CGWB) – India's official water agency  
**Unit:** Metres Below Ground Level (mbgl). Higher = water table is deeper = aquifer is depleted.

**Raw example:**
```
Well_Location    Jan_2000  May_2000  Aug_2000  Nov_2000
Delhi_Well_7     15 mbgl   18 mbgl   12 mbgl   14 mbgl
Delhi_Well_8     16 mbgl   19 mbgl   13 mbgl   15 mbgl
...              ...       ...       ...       ...
```

**Interpretation:**
- Jan (start of year): 15 m deep
- May (pre-monsoon/dry): 18 m deep (water table dropped 3 m)
- Aug (monsoon): 12 m deep (water table rose 6 m from rainfall recharge)
- Nov (post-monsoon): 14 m deep (some water was used up)

**What we do with it:**

1. **Aggregate spatially** (all wells within 50 km of a city → take the median depth for that city-year)
2. **Track depletion rate** (year-over-year change: is the water table dropping each year?)
3. **Measure recharge efficiency** (after monsoon, how much did the water level recover per mm of rainfall? If it recovered poorly, the aquifer is damaged)
4. **Combine with climate** (if rainfall is low AND the aquifer isn't recovering, that's a "dual deficit" = severe water crisis)

**Special cases:**
- **Jaipur problem:** Rajasthan state is missing from the CGWB dataset. We use the 5 nearest wells outside the state as a fallback and flag it.
- **Pre-2005:** Before 2005, data is sparse. We backfill missing years using the average depletion rate from 2005–2007 for that city.

---

### Dataset 3: Crop Suitability Maps (FAO GAEZ)

**What is it?**  
Geospatial maps (GeoTIFFs) from the UN Food and Agriculture Organization showing which crops grow best where.

**Source:** FAO GAEZ v4 database, based on 1981–2010 climate baseline  
**Resolution:** ~9 km grid cells across India  
**Coverage:** 53 crops; we use 6 (wheat, cotton, rice, sugarcane, mustard, ragi, groundnut)

**Suitability scale (1–7):**
- 1 = Not suitable (won't grow)
- 4 = Moderately suitable (will grow OK)
- 7 = Very suitable (optimal)

**Example extraction at city coordinates:**
```
City        Crop        Baseline_Suitability
Delhi       Wheat       6 (very suitable)
Jaipur      Mustard     5 (suitable)
Chennai     Rice        6 (very suitable)
```

**Crop requirements (ECOCROP thresholds):**  
Each crop has documented minimum needs:

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
- **Am** = Tropical monsoon (hot, wet, seasonal rain) → Mumbai, Kolkata, most of coastal India
- **Aw** = Tropical savanna (hot, seasonal rain, pronounced dry season) → Bangalore, Chennai
- **BSh** = Semi-arid hot (hot, dry, borderline desert) → Jaipur, Delhi, Hyderabad
- **BWh** = Arid hot (desert) → Hyper-dry regions
- **Cwa** = Humid subtropical (cold winter, hot summer) → Lucknow

**Why it matters:**  
Different crops thrive in different climate zones. If a city's zone shifts (e.g., tropical → semi-arid), the crops grown there may no longer be suitable.

**How we classify:**  
Based on annual temperature, precipitation, and seasonal patterns:
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

**Trigger conditions (conjunctive = ALL must be true):**

1. **Dual-deficit persistence:** For 2+ consecutive years, BOTH:
   - Atmospheric water deficit > 40% (insufficient rainfall)
   - Groundwater recharge efficiency < 30% (aquifer isn't recovering)
   
2. **Multi-threshold breach in the current year:** At least 2 of these 3 must be true:
   - Sowing window missed by >60% (monsoon too late)
   - Crop water deficit > 40% (too dry)
   - Growing Degree Days insufficient (too cold)

**Why this design?**
- **Persistence** filters out single-year bad luck; only multi-year stress counts
- **Multi-threshold** ensures the problem isn't just one factor but multiple systems failing simultaneously
- **Conservative** approach reduces false alarms

**Example CVLE:**
```
Year 2018 (Delhi, Wheat):
  Dual-deficit: Yes (2017–2018 both years had it)
  Sowing window miss: 65% ✓
  Water deficit: 45% ✓
  GDD adequate: No ✓
  
  Result: CVLE triggered for Delhi wheat in 2018
```

### What is the "Dual Deficit"?

The dual deficit is when both atmospheric water (rainfall) AND subsurface water (groundwater) systems fail simultaneously.

**Think of it like this:**  
A farmer relies on two water sources:
1. **Rainfall** (atmosphere)
2. **Wells/groundwater** (subsurface)

In normal years, if rainfall is low, the farmer can pump from wells. If wells are full, a bad rain year is survivable.

But if BOTH fail at once → severe crisis.

**Detection:**
```
Dual_deficit = (crop_water_deficit > 0.4) AND (recharge_efficiency < 0.30)
```

**Example:**
```
Delhi 2018:
  Rainfall in monsoon: 200 mm (need 450 mm) → water_deficit = 0.56 ✓
  Aquifer recovery: only 0.8 m per 100 mm rain → efficiency = 0.008 ✓
  
  Both failed → Dual deficit active
```

---

## Part 3: The 14-Step Pipeline

A **pipeline** is a series of scripts that run sequentially. Each step reads inputs, processes them, and writes outputs that the next step uses.

```
Raw Data
   ↓
Step 0-4: Data Processing & Aggregation
   ↓
Step 5: Merge all data + Create labels
   ↓
Step 6-9: Train ML Models & Explain them
   ↓
Step 10-13: Analyze results + Generate reports
   ↓
Step 14: Build interactive dashboard
```

### Phase 1: Data Collection & Standardization (Steps 0–4)

#### Step 0: Master Index
**Input:** Nothing (just definitions)  
**Output:** `master_index.csv` (250 rows)

Creates the backbone table: all 10 cities × 25 years = 250 city-year combinations.

```
city         year
Delhi        2000
Delhi        2001
...
Mumbai       2024
```

This is the "join key" that everything else attaches to.

---

#### Step 0b: Preprocess Datasets
**Input:** Raw CSV files  
**Output:** Standardized files (`kaggle_climate.csv` with consistent column names)

Cleans and standardizes the raw data:
- Rename messy column names to standard ones
- Convert units (wind speed: km/h → m/s)
- Derive missing fields (humidity from apparent temperature)
- Validate against known ranges

```python
# Example: Standardize wind speed
wind_kmh = 18  # original
wind_ms = wind_kmh / 3.6  # convert to m/s
→ 5 m/s
```

---

#### Step 1: Köppen Classification
**Input:** Daily climate data  
**Output:** `koppen_annual.csv` (250 rows)

For each city-year, compute annual climate summary and classify into Köppen zone.

```python
# Compute annual statistics
temp_mean = 26.5°C
rainfall_annual = 650 mm
temp_coldest_month = 18.2°C
rainfall_driest_month = 10 mm
rainfall_wettest_month = 180 mm

# Apply Köppen logic
if rainfall_annual < aridity_threshold:
    if rainfall_annual < 0.5 * aridity_threshold:
        zone = "BWh" (Desert)
    else:
        zone = "BSh" (Semi-arid)
elif temp_coldest_month >= 18:
    zone = "Aw" (Tropical savanna)
```

**Output example:**
```
city      year  koppen_zone  T_ann   P_ann
Delhi     2000  Cwa          24.5    680
Delhi     2004  BSh          26.8    640
Delhi     2005  BSh          27.2    620
```

---

#### Step 1b: Transition Detection
**Input:** `koppen_annual.csv`  
**Output:** `transition_report.json`

Detects persistent climate zone transitions (not single-year noise).

**Algorithm:**
- For each city, scan through years sequentially
- When zone changes (year i → year i+1), check if it holds for 3+ years
- If confirmed, record as a transition

```python
# Example: Delhi transitions

Zones over time: Cwa, Cwa, Cwa, BSh, BSh, BSh, BSh, BSh, BSh
Years:          2000 2001 2002 2003 2004 2005 2006 2007 2008

# Transition detected: 2003 (Cwa → BSh, confirmed 3 years 2003–2005)
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

#### Step 2: Climate Feature Engineering
**Input:** Daily climate data  
**Output:** `climate_annual.csv` (250 rows, 12 features)

Converts daily weather into annual crop-relevant features.

**Features computed:**

| Feature | How | Why |
|---------|-----|-----|
| `temp_mean` | Annual average | Baseline warmth |
| `rainfall_annual` | Sum of all daily rain | Total water availability |
| `n_dry_months` | Count of months <60 mm rain | Drought severity |
| `monsoon_onset_doy` | Day-of-year monsoon starts | Timing of planting window |
| `sowing_window_miss` | % delay past optimal sowing date | Planting delay penalty |
| `gdd_accumulation` | Sum of (T-base)° over Apr-Sep | Heat available for crop growth |
| `crop_water_deficit` | (needed rain - actual rain) / needed | Water shortage percentage |

**Example output:**
```
city      year  temp_mean  rainfall  monsoon_onset  gdd_accum  water_deficit
Delhi     2018  27.5       620       135 (May-15)   800        0.45
Jaipur    2018  28.1       315       150 (May-30)   750        0.65
```

---

#### Step 3: Groundwater Aggregation
**Input:** Well observation data (CGWB)  
**Output:** `groundwater_annual.csv` (250 rows, 6 features)

Aggregates point well measurements into city-level groundwater metrics.

**Process:**

1. Find all wells within 50 km of each city
2. For each year, take the median depth (pre- and post-monsoon)
3. Calculate derived metrics:
   - **Depletion rate** = year-over-year depth change
   - **Recharge efficiency** = (post-monsoon recovery) / (annual rainfall)

**Example:**
```
Delhi wells within 50 km:
  Well A: May depth 20 m, Nov depth 14 m
  Well B: May depth 22 m, Nov depth 16 m
  Well C: May depth 19 m, Nov depth 13 m
  
Median depth:
  Pre-monsoon (May): 20 m
  Post-monsoon (Nov): 14 m
  Recovery: 6 m
  Rainfall: 620 mm
  Efficiency: 6 m / 620 mm ≈ 0.009 (0.9%)
```

**Special case (Jaipur):**  
Rajasthan absent from CGWB dataset → use 5 nearest wells from other states and flag as `gw_imputed=2`

**Output:**
```
city      year  pre_monsoon_depth  post_monsoon_depth  recharge_efficiency
Delhi     2018  20.5              14.2                0.0097
Jaipur    2018  35.2              30.1                0.0082 (flagged)
```

---

#### Step 4: FAO GAEZ Extraction
**Input:** GeoTIFF rasters  
**Output:** `gaez_baseline.csv` (10 rows)

Extracts suitability class for each city's primary crop from raster maps.

**Process:**
1. For each city, look up GeoTIFF raster value at city coordinates
2. Rasters sometimes encode values 1–10; clip to 1–7 (rainfed scale)
3. Attach ECOCROP thresholds (GDD min, water requirement, etc.)

**Output:**
```
city        crop        gaez_baseline_class  gdd_min  water_req
Delhi       Wheat       6 (very suitable)    1200     450
Jaipur      Mustard     5 (suitable)         800      300
Lucknow     Sugarcane   7 (very suitable)    2500     1500
```

---

### Phase 2: Data Integration & Labeling (Step 5)

#### Step 5: Three-Way Join + CVLE Labels
**Input:** Master index + climate + groundwater + GAEZ + Köppen  
**Output:** `vegshift_master.csv` (250 rows, ~30 columns)

This is the master dataset combining everything.

**Process:**
1. Start with 250-row master index (city × year)
2. Merge climate features (12 cols)
3. Merge groundwater features (6 cols)
4. Merge static GAEZ/ECOCROP data (8 cols)
5. Merge Köppen zone per year (2 cols)
6. Fill missing values using city-group means
7. Create compound features: `dual_deficit`, `gdd_adequate`
8. **Create CVLE labels** using logic described earlier

**Compound features:**
```python
dual_deficit = (crop_water_deficit > 0.4) AND (recharge_efficiency < 0.30)
gdd_adequate = (gdd_accumulation >= crop_gdd_min)

# Then apply CVLE logic:
cvle_label = [
    1 if (dual_deficit[i-1]==1 AND dual_deficit[i]==1)
        AND (sow_miss[i]>0.6 OR water_def[i]>0.4 OR NOT gdd_adequate[i])
        AND (satisfies 2 of 3 thresholds)
    else 0
]
```

**Output shape:** 250 rows × 30 columns (all features ready for modeling)

---

### Phase 3: Machine Learning (Steps 6–9)

#### Step 6: Train Temporal Fusion Transformer (TFT)
**Input:** `vegshift_master.csv`  
**Output:** `vegshift-tft-best.ckpt` (trained model)

TFT is a deep learning model designed for time series forecasting with multiple feature types.

**Architecture:**
- **Encoder:** Looks back 5 years
- **Decoder:** Predicts next 1 year
- **Features:** 17 time-varying inputs + 2 static categoricals + 5 static reals
- **Output:** 7 quantile predictions (10th, 25th, 50th, 75th, 90th percentiles + 2 others) for CVLE probability

**Why TFT?**
- Handles mixed feature types (categorical, numerical, temporal)
- Attention mechanism shows which past years drove predictions (interpretability)
- Probabilistic output (risk scores, not hard classifications)
- Designed for small datasets (we have 250 rows with temporal structure)

**Training:**
- Train on years 0–18 (2000–2018)
- Validate on years 0–21 (2000–2021)
- Early stopping if validation loss stops improving
- Save best checkpoint

---

#### Step 7: TFT Prediction + Attention Extraction
**Input:** Best TFT checkpoint + test data  
**Output:** `tft_predictions.csv`, `tft_attention_weights.json`

Run the trained model on all data to get:
1. **Predicted CVLE probabilities** for each city-year (0–1 risk score)
2. **Attention weights** showing which past years mattered most

**Attention interpretation:**  
"To predict 2020's CVLE probability, the model paid X% attention to 2019, Y% to 2018, Z% to 2017, etc."

This reveals whether the model learned meaningful patterns or is just memorizing noise.

---

#### Step 8: Train Baseline Models
**Input:** `vegshift_master.csv`  
**Output:** `rf_baseline.pkl`, `lr_baseline.pkl`, `lstm_baseline.pt`

Train simpler comparison models:

1. **Random Forest:** Decision tree ensemble (non-temporal, shows feature importances)
2. **Logistic Regression:** Linear classifier (most interpretable)
3. **LSTM:** Recurrent neural network (temporal baseline)

These provide sanity checks:
- Do all models agree on at-risk cities?
- Is TFT's complexity justified or is a simpler model better?
- What's the baseline performance?

---

#### Step 9: SHAP Explainability
**Input:** Random Forest model + test data  
**Output:** `shap_explanation.json`

Compute SHAP (SHapley Additive exPlanations) values to explain Random Forest predictions.

**What it shows:**
- **Global importance:** Which features matter most across all predictions?
  - Example: `crop_water_deficit` (0.35), `depletion_rate` (0.28), `dual_deficit` (0.22)
  
- **Per-city importance:** Which features matter for each city?
  - Delhi: sowing_window_miss, monsoon_onset_doy, temperature
  - Jaipur: crop_water_deficit, rainfall_annual, depletion_rate

**Why SHAP?**  
More accurate than other importance methods; mathematically grounded in game theory.

---

### Phase 4: Analysis & Validation (Steps 10–13)

#### Step 10: Causal Linkage Analysis
**Tests:** Do climate transitions cause CVLE events?

**Method:**
For each detected transition (e.g., Delhi 2003: Cwa → BSh):
1. Compute average CVLE probability 3 years pre-transition (2000–2002)
2. Compute average CVLE probability 3 years post-transition (2004–2006)
3. Run statistical test (Wilcoxon signed-rank) to check if increase is significant
4. Measure CVLE lag: How many years after transition did the first CVLE occur?

**Output:** `transition_cvle_linkage.json`
```json
{
  "city": "Delhi",
  "transition_year": 2003,
  "pre_risk_mean": 0.12,
  "post_risk_mean": 0.45,
  "risk_delta": +0.33,
  "p_value": 0.032,
  "significant": true,
  "post_transition_cvle_lag": 2
}
```

**Interpretation:**  
Delhi's CVLE risk jumped significantly after the 2003 transition, and the first CVLE occurred 2 years later (in 2005).

---

#### Step 11: Viability Trend Analysis
**Tests:** Are crops getting steadily less viable over 25 years?

**Method:**
For each city, fit a linear regression:
- **X-axis:** Year (2000–2024)
- **Y-axis:** RF-predicted CVLE probability

**Output:** `viability_trend_report.json`
```json
{
  "city": "Delhi",
  "slope": 0.0045,
  "r_squared": 0.62,
  "p_value": 0.008,
  "trend": "deteriorating"
}
```

**Interpretation:**
- **Slope 0.0045:** CVLE risk increases by 0.45% per year
- **p-value 0.008:** Statistically significant (p < 0.05)
- **Trend:** "deteriorating" (wheat viability declining over time)

---

#### Step 12: Control City Validation
**Purpose:** Ensure the model isn't finding spurious patterns.

Control cities: **Pune**, **Kolkata**, **Mumbai**  
Expectation: These should remain climatically stable and agriculturally viable.

**Checks:**
1. **Trend check:** Trends should be "stable" (p ≥ 0.05)
2. **CVLE count:** Should be 0 or very few
3. **Transition count:** Should be 0 (no zone changes)

**Example output:**
```
✓ Pune: trend=stable (p=0.42), CVLE count=0, transitions=0
✓ Kolkata: trend=stable (p=0.68), CVLE count=0, transitions=0
✓ Mumbai: trend=stable (p=0.53), CVLE count=0, transitions=0
```

If ANY control fails → model has a problem (overfit, mislabeling, etc.)

---

#### Step 13: Recharge Grid Export
**Output:** `groundwater_recharge_grid.json`

Exports groundwater recharge efficiency for all cities × all years in a grid format for visualization.

```json
{
  "Delhi": {"2000": 0.008, "2001": 0.007, "2002": 0.006, ...},
  "Jaipur": {"2000": 0.005, "2001": 0.004, "2002": 0.003, ...},
  ...
}
```

This lets the dashboard show trends in aquifer health over time.

---

### Phase 5: Visualization (Step 14)

#### Step 14: Interactive Dashboard
**Output:** Web app at `http://localhost:8050`

Eight interactive panels:

1. **Sowing Window Drift:** Monsoon onset vs. optimal sowing date over time (with transitions marked)
2. **Dual-Deficit Heatmap:** Years when both atmospheric + groundwater failed (red grid)
3. **CVLE Timeline:** Bar chart of CVLE counts per city (control cities in gray)
4. **Transition → CVLE Linkage:** Table of all transitions with significance tests and lags
5. **Recharge Efficiency Trend:** Groundwater recovery over time (falling line = aquifer damage)
6. **Köppen Zone History:** Scatter plot of zone changes over time
7. **SHAP Feature Importance:** Global and per-city feature contributions
8. **Trend Report:** 25-year viability risk slope per city (color-coded by trend)

All charts are interactive: hover for details, filter by city, etc.

---

## Part 4: Data Quality & Special Cases

### Missing Data Handling

**Humidity:** Derived via physics formula (Steadman inversion), validated against climatological norms.

**Pre-2005 groundwater:** Backfilled using 2005–2007 average depletion rate per city.

**Jaipur groundwater:** Rajasthan state missing from CGWB; use 5 nearest wells from other states and flag `gw_imputed=2`.

**Method:** City-group mean imputation (never leak across cities).

---

### Data Provenance Flags

- **`gw_imputed=0`:** Within 50 km radius (authoritative)
- **`gw_imputed=1`:** Filled by mean imputation
- **`gw_imputed=2`:** Nearest-wells fallback (Jaipur)

---

### Known Limitations

1. **GAEZ raster encoding:** Some values 8–10 represent irrigated potential but are clipped to 7 for consistency
2. **Jaipur:** Groundwater data is extrapolated from other states (use caution)
3. **Pre-2005:** Climate well-measured but groundwater sparse; results less confident
4. **CVLE threshold conservatism:** Multi-year persistence + multi-threshold design reduces sensitivity

---

## Part 5: Key Outputs Explained

### What do the outputs mean?

| Output File | What It Contains | Example | How to Use |
|---|---|---|---|
| `transition_report.json` | All detected climate zone transitions | Delhi: Cwa → BSh in 2003 | Check if city's climate officially shifted |
| `crop_viability_events.json` | All detected CVLE events (timestamped) | Delhi wheat: CVLE in 2018 | Identifies exact year crop viability failed |
| `transition_cvle_linkage.json` | Pre/post-transition CVLE risk (with stats) | Delhi transition 2003: risk ↑ from 12% → 45% (p=0.032) | Proves transition causes viability loss |
| `viability_trend_report.json` | 25-year slope of CVLE risk | Delhi: slope=+0.0045/year (p=0.008) = "deteriorating" | Shows long-term trend (improving/stable/deteriorating) |
| `shap_explanation.json` | Which features drive CVLE predictions | Global: crop_water_deficit (35%), depletion_rate (28%) | Understand why crops failed |
| `tft_attention_weights.json` | Which years matter for prediction | Delhi: last year (40%), year-2 (30%), year-3 (20%) | Reveals model's temporal logic |
| `groundwater_recharge_grid.json` | Annual aquifer recovery for all cities | Delhi 2020: efficiency=0.008 | Track groundwater health |
| Dashboard | Interactive visualization | All above data visualized | Explore patterns and communicate findings |

---

## Part 6: From Data to Insight — A Complete Example

Let's walk through Delhi wheat from start to finish.

### Step 0–4: Raw Data → Features

**Step 0:** Create master index  
→ Delhi appears 25 times (2000–2024)

**Step 1–2:** Classify Köppen + compute climate features
```
Year  Temperature  Rainfall  Köppen  GDD   Water_Deficit
2000  24.5°C       680 mm    Cwa     1250  0.05
2003  26.8°C       640 mm    BSh     900   0.15  ← Zone shifted!
2010  27.2°C       620 mm    BSh     750   0.30
2018  28.1°C       500 mm    BSh     600   0.45  ← Water crisis
```

**Step 3:** Groundwater aggregate
```
Year  Pre_Monsoon_Depth  Recharge_Eff  Depletion_Rate
2000  15 m               0.010         —
2003  17 m               0.008         +2 m (depleting)
2018  25 m               0.005         +1.5 m/year
```

### Step 5: Combine + Label

Create `vegshift_master.csv` row for Delhi 2018:
```
city="Delhi", year=2018, crop="wheat",
temp_mean=28.1, rainfall=500, gdd_accum=600, water_deficit=0.45,
pre_monsoon_depth=25, recharge_eff=0.005, gdd_min=1200,
dual_deficit=1 (water_def>0.4 AND recharge_eff<0.30),
gdd_adequate=0 (600 < 1200),
sow_window_miss=0.65 (monsoon late)

→ CVLE_label = 1 (triggers on dual_deficit + 2-of-3 thresholds)
```

### Step 6–9: Train Models

TFT learns: "When dual-deficit persists + GDD fails + sowing window misses → CVLE"

SHAP analysis finds: "For Delhi, water_deficit (35%) and monsoon_onset (30%) drive CVLE most"

### Step 10–11: Analyze

**Linkage:** Delhi's 2003 transition (Cwa → BSh) is followed by:
- CVLE risk: 12% (pre) → 45% (post), p=0.032 ✓ significant
- First CVLE: 2018 (lag = 15 years)

**Trend:** Delhi's viability slope = +0.0045/year (p=0.008) = "deteriorating"

### Step 14: Dashboard

Visualize:
- Sowing window drift (monsoon getting later)
- Dual-deficit years (red heatmap shows 2017–2019 all hit)
- CVLE timeline (Delhi = 1 event in 2018)
- Recharge trend (well depth deepening 1–2 m/year)

---

## Part 7: Why This Approach?

### Why 3 Datasets?

- **Climate alone:** Tells us temperature/rainfall but not sustainable water
- **Groundwater alone:** Shows depletion but not immediate climate stress
- **Together:** Comprehensive picture of water crisis (both short-term weather + long-term aquifer health)

### Why Dual-Deficit?

Single-factor thresholds (e.g., "rainfall < X") produce too many false positives. Dual-deficit ensures both atmospheric and subsurface systems are failing, indicating real crisis.

### Why Temporal Models (TFT, LSTM)?

Crops respond to multi-year patterns, not single-year anomalies. Temporal models capture this; static models don't.

### Why Transitions → CVLE Linkage?

Proves the causal story: climate shift → crop loss. Without linkage analysis, we can't distinguish correlation from causation.

### Why Control Cities?

If Pune/Kolkata/Mumbai show deterioration, our labels are wrong. Controls validate the entire pipeline.

---

## Part 8: Technical Stack

| Component | Technology | Why |
|---|---|---|
| Data Processing | Pandas, NumPy | Fast, standard data manipulation |
| Spatial (wells) | Haversine formula | Compute distances without external libs |
| Geospatial (rasters) | Rasterio | Read GeoTIFF suitability maps |
| ML Models | Scikit-learn (RF, LR) | Fast, interpretable tree/linear models |
| Deep Learning | PyTorch + PyTorch Lightning | TFT, LSTM implementations |
| Time Series | PyTorch Forecasting | Specialized TFT library |
| Explainability | SHAP | Industry-standard feature importance |
| Statistics | SciPy | Wilcoxon test, distributions |
| Visualization | Plotly + Dash | Interactive web dashboard |
| Orchestration | Python subprocess | Sequential step execution |

---

## Summary

VegShift combines three datasets (climate, groundwater, crop requirements) to detect when crops become unviable after climate zone shifts in Indian cities.

**The pipeline:**
1. Standardizes data (Steps 0–4)
2. Merges into master table (Step 5)
3. Trains ML models (Steps 6–9)
4. Validates findings (Steps 10–12)
5. Visualizes insights (Step 14)

**Key innovations:**
- Dual-deficit indicator (simultaneous atmospheric + subsurface failure)
- Causal linkage analysis (transition → CVLE)
- Multi-model ensemble (TFT + RF + LR + LSTM for validation)
- Control city validation (Pune/Kolkata/Mumbai prove model isn't spurious)
- Explainability (SHAP + TFT attention)

**Output:** Timestamped Crop Viability Loss Events with full causal and feature-level explanations.

---

## Glossary

- **CVLE:** Crop Viability Loss Event — when a crop becomes unviable for a city
- **Köppen:** Climate classification system
- **GDD:** Growing Degree Days — heat accumulation needed for crop maturation
- **Dual-deficit:** Simultaneous atmospheric (low rainfall) + subsurface (low recharge) failure
- **Monsoon onset:** Day-of-year when rainy season begins
- **Recharge efficiency:** (Water level recovery) / (Annual rainfall)
- **SHAP:** Feature importance method based on game theory
- **TFT:** Temporal Fusion Transformer — deep learning time series model
- **LSTM:** Long Short-Term Memory — recurrent neural network for sequences
- **Pipeline:** Sequential data processing workflow

