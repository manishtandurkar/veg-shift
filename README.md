# VegShift

Detects vegetation viability loss in Indian cities after climate zone transitions. Answers: after a city's Koppen zone shifts, which crops can no longer be grown there, and when exactly did that become true?

**Cities:** Delhi, Mumbai, Chennai, Kolkata, Bangalore, Hyderabad, Ahmedabad, Jaipur, Lucknow, Pune  
**Time range:** 2000–2024  
**Output:** Crop Viability Loss Events (CVLEs) with timestamps, groundwater context, and causal linkage to climate transitions.

See [AGENTS.md](AGENTS.md) for full pipeline design, dataset details, and all step implementations.

---

## Setup

```bash
pip install -r requirements.txt
```

---

## Data

All three datasets are already downloaded:

| Dataset | Location | Notes |
|---|---|---|
| DS1 — Climate (Open-Meteo) | `data/raw/climate/india_2000_2024_daily_weather.csv` | Standardized to `data/processed/kaggle_climate.csv` by step0b |
| DS2 — CGWB Groundwater | `data/raw/cgwb/CGWB_India_quality_controlled_GWLs_ref_sy_2000_2022.csv` | Rajasthan absent; Jaipur uses nearest-well fallback in Step 3 |
| DS3 — FAO GAEZ TIFFs | `data/raw/gaez/*.tif` | 6 crop suitability rasters; values >7 clipped in Step 4 |

---

## Run

```bash
python run_vegshift.py
```

Or run individual steps:

```bash
python pipeline/step0_master_index.py
python pipeline/step0b_preprocess_datasets.py
python pipeline/step1_koppen_classification.py
# ... through step14
```

---

## Output

Dashboard at `http://localhost:8050` after running Step 14. Intermediate outputs in `data/output/`.
