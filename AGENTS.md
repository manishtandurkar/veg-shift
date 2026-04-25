# VegShift — agents.md
## Vegetation Viability Loss Detection After Climate Zone Transitions
### Dataset Acquisition, Fusion Pipeline, and Model Architecture

---

## 1. Datasets

### Dataset 1 — Kaggle Historical Climate Dataset
**Role in pipeline:** Primary atmospheric layer. Already present in the parent CTRIS pipeline.
**What it contains:** Daily temperature (max, min, mean), rainfall, humidity, wind speed, and sunshine hours for 10 Indian cities from 2000 to 2024.
**Used for:** Computing monsoon onset day, Growing Degree Days, crop water deficit ratio, sowing window miss score, and all 9 core CTRIS climate features.

---

### Dataset 2 — CGWB Quality-Controlled Groundwater Levels Dataset
**Full name:** Quality Controlled, Reliable Groundwater Level Data with Corresponding Specific Yield over India (2000–2022)
**Source:** Scientific Data (Nature), published October 2025
**Direct URL:** `https://www.nature.com/articles/s41597-025-05899-5`
**Data download:** The processed CSV file `CGWB_India_quality_controlled_GWLs_ref_sy_2000_2022.csv` is hosted on Figshare at `https://figshare.com/articles/dataset/CGWB_India_quality_controlled_GWLs`

**What it contains:**
- 2,759 quality-controlled observation wells across India
- Seasonal groundwater levels (metres below ground level) measured in January, May, August, and November from 2000 to 2022
- Each row is one well station with metadata: Station Code, State, District, Latitude, Longitude, Aquifer Type, Well Depth, and seasonal GWL columns organized as `Jan-00`, `May-00`, `Aug-00`, `Nov-00` ... through `Nov-22`
- Specific yield (Sy) values per well estimated from hydrogeological maps

**Why this dataset over raw CGWB portal data:** The raw INDIA-WRIS portal (`indiawris.gov.in`) has the same underlying data but requires manual station-by-station download. This Nature Scientific Data publication has already applied three-sigma outlier removal, eliminated duplicate readings, and retained only wells with at least two consistent values per year — making it directly usable without further cleaning.

**Backup source:** If Figshare link is unavailable, the raw CGWB portal data is also available at `https://ckandev.indiadataportal.com/dataset/groundwater/resource/580a8f6e-3d86-4ca7-ac7d-cd5df12b443c/download/cgwb-changes-in-depth-to-water-level.csv` — this is the India Data Portal CSV maintained by CGWB with 22,965 observation wells. It requires manual outlier filtering before use.

**Cities with sufficient well coverage:** Delhi, Bangalore, Chennai, Hyderabad, Ahmedabad, Jaipur, Lucknow — 7 of 10 cities. Mumbai, Pune, and Kolkata have fewer inland wells but coastal/urban station data is available.

---

### Dataset 3 — FAO GAEZ v4 Crop Suitability Index
**Full name:** Global Agro-Ecological Zones version 4 — Suitability and Attainable Yield (Theme 4)
**Source:** FAO and IIASA (International Institute for Applied Systems Analysis)
**Direct portal URL:** `https://gaez.fao.org/`
**Data download page:** `https://gaez.fao.org/datasets/hqfao::gaez-suitability-and-attainable-yield/about`
**Crop summary CSV files (India sub-national):** Available at `https://data.apps.fao.org/catalog/iso/a6965302-55bf-46e9-8e42-6d046938333b`

**What it contains:**
- Crop suitability index (classified 1–7: Not Suitable to Very High) for 53 crops under rainfed and irrigated conditions
- Based on historical climate period 1981–2010
- Available at approximately 9 km spatial resolution as GeoTIFF rasters
- For India, sub-national summary tables are available as CSV files aggregated by state and agro-ecological zone
- Covers wheat, rice, cotton, sugarcane, sorghum, groundnut, and finger millet — all crops used in VegShift
- Also includes crop water indicators: reference evapotranspiration, growing period length, and water deficit index per crop per grid cell

**How it is used in VegShift:** GAEZ v4 provides the **baseline suitability score** for each city's primary crop under the 1981–2010 reference climate. This is not a training feature — it is a reference constant. The crop's minimum thermal and moisture requirements documented in GAEZ (via the ECOCROP database at `https://gaez.fao.org/pages/ecocrop`) serve as the threshold constants against which the 25-year observed data is tested.

**Specific files to download:**
- `whe_suit_class_r_hist_cruts32_7clim.tif` — wheat suitability raster, rainfed, 1981–2010
- `cot_suit_class_r_hist_cruts32_7clim.tif` — cotton suitability raster
- `rcw_suit_class_r_hist_cruts32_7clim.tif` — wetland rice suitability raster
- `suc_suit_class_r_hist_cruts32_7clim.tif` — sugarcane suitability raster
- `srg_suit_class_r_hist_cruts32_7clim.tif` — sorghum suitability raster
- India sub-national summary CSV: `GAEZv4_IND_crop_summary.csv` (available from the crop summary page)

---

## 2. Dataset Fusion Pipeline

The three datasets operate at different spatial and temporal resolutions. Fusing them into a single model-ready tabular dataset requires four explicit alignment steps.

---

### Step 1 — Establish the Master Index

Create a master index with two columns: `city` and `year`. This is a 10 × 25 grid (10 cities, years 2000–2024) giving 250 base rows. All three datasets will be joined onto this index. Any city-year where a dataset has no coverage is handled by imputation (described in Step 4).

```
master_index.csv
city        | year
------------|-----
Delhi       | 2000
Delhi       | 2001
...
Mumbai      | 2024
```

---

### Step 2 — Aggregate Dataset 1 (Climate) to Yearly City-Level

The Kaggle dataset is already at city level. Aggregate daily records to annual summaries per city per year:
- Mean annual temperature, total annual rainfall, mean wind speed (already done in parent pipeline)
- Additionally compute: monsoon onset day-of-year (first 5-day period where daily rainfall ≥ 2.5mm, matching IMD definition), GDD accumulation per crop growing season, crop water deficit ratio

**Output:** `climate_annual.csv` — 250 rows × 14 columns (city, year, + 12 climate features)

---

### Step 3 — Aggregate Dataset 2 (CGWB) to Yearly City-Level

The CGWB dataset is at well level (2,759 wells) with seasonal readings. Two aggregation steps are needed.

**Step 3a — Spatial aggregation (wells → city):**
For each city, select all wells within a 50 km radius of the city centroid using the Latitude and Longitude columns. Compute the median pre-monsoon depth (May reading) and post-monsoon depth (November reading) across all selected wells for that city and year. Median is used instead of mean to avoid influence from outlier wells.

```python
# Pseudocode
for city in cities:
    wells_in_radius = cgwb_df[haversine(cgwb_df[['lat','lon']], city_coords) <= 50]
    city_gw = wells_in_radius.groupby('year')[['May', 'Nov']].median()
```

**Step 3b — Temporal aggregation (seasonal → annual features):**
From the May and November medians per city per year, compute:
- `pre_monsoon_depth` = May reading (mbgl)
- `post_monsoon_depth` = November reading (mbgl)
- `depletion_rate` = pre_monsoon_depth(year) − pre_monsoon_depth(year−1)
- `recharge_efficiency` = (pre_monsoon_depth − post_monsoon_depth) / total_monsoon_rainfall

**Output:** `groundwater_annual.csv` — ~175 rows × 6 columns (some cities have partial coverage pre-2005)

---

### Step 4 — Extract Dataset 3 (FAO GAEZ) as Static Reference Constants

FAO GAEZ is a static dataset — it represents baseline suitability under the 1981–2010 climate, not a time series. It is used differently from the other two datasets.

**Step 4a — Extract city-level suitability score:**
For each city, use the city's coordinates to extract the pixel value from each crop-specific GeoTIFF raster using `rasterio`. This gives one baseline suitability class (1–7) per city per crop.

```python
import rasterio
with rasterio.open('whe_suit_class_r_hist_cruts32_7clim.tif') as src:
    row, col = src.index(city_lon, city_lat)
    delhi_wheat_baseline = src.read(1)[row, col]  # Returns 1–7
```

**Step 4b — Extract crop threshold constants from ECOCROP:**
From the ECOCROP database (`gaez.fao.org/pages/ecocrop`), extract for each crop:
- `gdd_min` — minimum growing degree days required
- `water_req_mm` — seasonal water requirement in mm
- `optimal_sowing_doy` — optimal sowing day-of-year (from ICAR calendar cross-referenced)
- `max_temp_threshold` — upper temperature limit for the crop

These become a static lookup table (`crop_thresholds.csv`) used as constants during feature engineering — they are not model inputs but are used to compute the engineered features (sowing window miss score, crop water deficit ratio, GDD adequacy flag).

**Output:** `gaez_baseline.csv` — 10 rows × 5 columns (one row per city, static reference only)

---

### Step 5 — Three-Way Join onto Master Index

```python
import pandas as pd

master = pd.read_csv('master_index.csv')           # 250 rows
climate = pd.read_csv('climate_annual.csv')        # 250 rows
groundwater = pd.read_csv('groundwater_annual.csv') # ~175 rows
gaez = pd.read_csv('gaez_baseline.csv')            # 10 rows (static)

# Join climate (left join — all 250 rows retained)
df = master.merge(climate, on=['city', 'year'], how='left')

# Join groundwater (left join — city-years without GW data get NaN)
df = df.merge(groundwater, on=['city', 'year'], how='left')

# Join GAEZ — broadcast static baseline across all years for each city
df = df.merge(gaez, on='city', how='left')
```

**Handling missing groundwater values (pre-2005 and 3 cities):**
- For years 2000–2004 where CGWB data is unavailable: impute `depletion_rate` using linear backfill from 2005–2007 trend per city. Flag these rows with `gw_imputed = 1`.
- For Mumbai, Pune, Kolkata where well density is low: use the district-level CGWB yearbook values (available from `cgwb.gov.in/en/ground-water-level-monitoring` as annual PDFs, which can be manually extracted for these 3 cities).

**Final output:** `vegshift_master.csv` — 250 rows × 22 columns (city, year, 12 climate features, 4 groundwater features, 4 GAEZ reference constants, 1 imputation flag, 1 dual-deficit flag)

---

## 3. Model — Temporal Fusion Transformer (TFT)

### Why Not Random Forest or Linear Regression

The existing literature — all 10 primary papers reviewed — uses Random Forest, Logistic Regression, SVR, ANN, or LightGBM. Using any of these models produces no differentiation from prior work. The core problem VegShift solves is inherently temporal: a Crop Viability Loss Event is defined by a *sequence* of deteriorating conditions over multiple years, not by a single year's feature values in isolation. Standard ML classifiers treat each row (city-year) as independent — they cannot capture the fact that 3 consecutive years of dual-deficit is structurally different from 3 isolated bad years. A sequence-aware model is required.

The **Temporal Fusion Transformer (TFT)**, introduced by Google Research (Lim et al., 2021) and applied to wheat yield prediction at IEEE INOCON 2023 (DOI: `10.1109/INOCON57975.2023.10101144`), is the appropriate choice. It is the only deep learning architecture specifically designed for multi-horizon time series forecasting that also produces interpretable attention weights — addressing the explainability concern that makes pure LSTM or vanilla Transformer models unsuitable for policy applications.

---

### TFT Architecture — What Each Component Does

**1. Variable Selection Networks (VSN)**
At each timestep, the VSN learns which of the 16 input features are most relevant for that specific city's prediction. For Delhi, it may heavily weight depletion rate and sowing window miss. For Chennai, it may weight post-monsoon recharge and GDD. This is the TFT equivalent of SHAP feature importance — but learned dynamically per timestep rather than computed post-hoc.

**2. Static Covariate Encoders**
The FAO GAEZ baseline suitability scores and crop threshold constants are static inputs — they do not change year to year. TFT has dedicated encoders for static covariates that inject city-specific crop identity (which crop, what baseline suitability, what thresholds) as context into every temporal layer. This is a structural advantage over RF, which cannot distinguish static context from time-varying features.

**3. LSTM Sequence Encoder (Local Processing)**
Processes the time-ordered sequence of climate and groundwater features per city, capturing local temporal patterns — for example, recognising that 3 consecutive years of rising depletion rate is a more severe signal than one spike.

**4. Interpretable Multi-Head Self-Attention (Long-Range Dependencies)**
Learns which past years are most predictive of the current year's viability risk. If the attention head consistently attends to years 3–5 years prior, it means the model has learned that crop viability decline follows climate zone transitions with a multi-year lag — which is exactly the transition-to-CVLE lag the pipeline is designed to detect.

**5. Quantile Outputs**
TFT outputs three quantiles: 10th, 50th, and 90th percentile of viability risk. This gives uncertainty bounds around every prediction — the 90th percentile output is used to trigger a CVLE alert conservatively, the 50th percentile is used for trend regression.

---

### Input Formatting for TFT

TFT requires data in a panel time series format. Each city becomes one time series of length 25 (years 2000–2024).

```
city    | year | [12 climate features] | [4 GW features] | [4 static GAEZ constants] | cvle_label
--------|------|------------------------|-----------------|---------------------------|----------
Delhi   | 2000 | ...                   | ...             | wheat, 4, 350, 450, 35    | 0
Delhi   | 2001 | ...                   | ...             | wheat, 4, 350, 450, 35    | 0
...
Delhi   | 2024 | ...                   | ...             | wheat, 4, 350, 450, 35    | 1
Jaipur  | 2000 | ...                   | ...             | mustard, 3, 180, 300, 30  | 0
...
```

- **Time-varying known inputs:** all 12 climate features + 4 groundwater features (change each year)
- **Time-varying observed targets:** CVLE label (the output to predict)
- **Static covariates:** GAEZ baseline class, crop GDD minimum, crop water requirement, crop max temperature (constant per city)

---

### Training Configuration

| Parameter | Value |
|-----------|-------|
| Train split | Cities × Years 2000–2018 (190 rows across 10 cities) |
| Validation split | 2019–2021 (30 rows) |
| Test split | 2022–2024 (30 rows) |
| Sequence length | 5 years (lookback window) |
| Forecast horizon | 1 year ahead |
| Quantile outputs | 10th, 50th, 90th percentile |
| Attention heads | 4 |
| LSTM hidden size | 64 |
| Dropout | 0.1 |
| Loss function | Quantile loss (pinball loss) |
| Optimizer | Adam, lr = 1e-3 |
| Library | `pytorch-forecasting` (PyTorch) |

**Note on dataset size:** 250 rows is small for a deep learning model. This is handled by: (1) using a 5-year sliding window which expands the effective training samples from 190 rows to ~150 windows; (2) applying per-city normalisation (z-score) so the model learns relative change rather than absolute values; (3) using dropout regularisation. The model's advantage over RF is not in raw accuracy on this dataset size — it is in the interpretable attention weights and the sequence-aware architecture, which are the academic contributions.

---

### Baseline Comparison Models

To demonstrate TFT's advantage, two baselines are trained and compared:

**Baseline 1 — Random Forest Classifier** (standard in all 10 reviewed papers): trained on the same features but treating each city-year independently. Cannot capture multi-year temporal dependencies.

**Baseline 2 — LSTM Classifier**: captures temporal dependencies but produces no interpretable attention weights. Used to show that the interpretability of TFT is an improvement over a plain LSTM without sacrificing much accuracy.

The expected result: TFT outperforms RF on the test split (2022–2024) specifically for cities that experienced multi-year deterioration trajectories (Delhi, Jaipur), while performing comparably to RF on stable control cities (Pune, Kolkata, Mumbai). The attention weight visualisation then shows *why* — confirming that TFT learned to attend to the years surrounding the L4 transition events.

---

## 4. Output Files

| File | Contents | Produced by |
|------|----------|-------------|
| `vegshift_master.csv` | Final fused dataset, 250 rows × 22 columns | Fusion pipeline |
| `crop_viability_events.json` | All CVLE instances per city per year | TFT classifier output |
| `tft_attention_weights.json` | Per-city attention weights across the 25-year window | TFT interpretability layer |
| `transition_cvle_linkage.json` | Every L4 transition → pre/post viability risk, p-value | M3 causal linkage |
| `viability_trend_report.json` | Quantile regression trend per city (slope, R², p-value) | M2 trend regression |
| `groundwater_recharge_grid.json` | Annual recharge efficiency per city as 10×25 grid | Fusion pipeline |

---

## 5. Summary Table

| Component | Detail |
|-----------|--------|
| Dataset 1 | Kaggle Climate — 25 years, 10 cities, daily atmospheric data |
| Dataset 2 | CGWB Quality-Controlled GWLs (Nature Sci. Data 2025) — 2,759 wells, 2000–2022, seasonal depth |
| Dataset 3 | FAO GAEZ v4 — static crop suitability baseline + ECOCROP crop threshold constants |
| Fusion method | Spatial median aggregation (wells → city, 50 km radius) + temporal annual aggregation + static broadcast join |
| Primary model | Temporal Fusion Transformer (TFT) — sequence-aware, interpretable attention, quantile outputs |
| Baseline models | Random Forest + LSTM (for comparison) |
| Novel output | Crop Viability Loss Event — timestamped, dual-layer, city-specific food security event |
| SDGs | SDG 2 (Zero Hunger), SDG 6 (Clean Water), SDG 13 (Climate Action) |

---

*VegShift — agents.md | April 2026*
*Integrated with CTRIS Parent Pipeline*
