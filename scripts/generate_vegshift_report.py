# Simple PDF generator for VegShift summary
# Generates docs/VegShift_Full_Pipeline_Report.pdf with a plain-text report

import os
import textwrap

OUT = 'docs/VegShift_Full_Pipeline_Report.pdf'

def escape(s):
    return s.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')

report = []
report.append('VegShift — Full Pipeline Summary (Steps 0–9)')
report.append('Author: VegShift pipeline auto-report')
report.append('Date: 2026-04-28')
report.append('\n')
report.append('Purpose: A simple, shareable one-shot explanation of each implemented step,')
report.append('with a short example input row and example output row per step. Keep this PDF')
report.append('for teammates as a quick reference to run and verify the pipeline.')
report.append('\n')

# Step descriptions with compact examples
steps = [
    {
        'title': 'Step 0 — Master Index',
        'what': 'Builds the 10-city × 25-year backbone table used to join all datasets.',
        'command': 'python pipeline/step0_master_index.py',
        'example_input': 'none (cities list + years are hardcoded)',
        'example_output': 'city,year\nDelhi,2000\nMumbai,2000',
        'notes': 'Produces data/processed/master_index.csv with 250 rows.'
    },
    {
        'title': 'Step 0b — Preprocess raw climate data',
        'what': 'Standardizes daily climate fields and derives humidity when missing.',
        'command': 'python pipeline/step0b_preprocess_datasets.py',
        'example_input': 'one raw daily row: city,date,temperature_2m_max,temperature_2m_min,precipitation_sum',
        'example_input_row': 'Delhi,2000-01-01,32.5,21.1,0.0',
        'example_output': 'city,date,temp_max,temp_min,temp_mean,rainfall',
        'example_output_row': 'Delhi,2000-01-01,32.5,21.1,26.8,0.0',
        'notes': 'Writes data/processed/kaggle_climate.csv used downstream.'
    },
    {
        'title': 'Step 1 — Koppen-Geiger classification',
        'what': 'Aggregates daily to annual stats and assigns a Köppen zone per city-year.',
        'command': 'python pipeline/step1_koppen_classification.py',
        'example_input': 'monthly/annual aggregates (temp_mean, rainfall)',
        'example_output': 'city,year,koppen_zone,koppen_zone_enc',
        'example_output_row': 'Delhi,2005,BSh,2',
    },
    {
        'title': 'Step 1b — Transition detection',
        'what': 'Finds persistent changes in Köppen zone (new zone persists ≥ 3 years).',
        'command': 'python pipeline/step1b_transition_detection.py',
        'example_input': 'koppen_annual.csv (time series for a city)',
        'example_output': 'data/output/transition_report.json',
        'example_output_row': "{'city':'Lucknow','transition_year':2007,'from_zone':'Cwa','to_zone':'BSh'}",
    },
    {
        'title': 'Step 2 — Climate feature aggregation',
        'what': 'Computes monsoon onset, GDD, sowing-window miss, annual rainfall, etc.',
        'command': 'python pipeline/step2_climate_aggregate.py',
        'example_input': 'daily rows from kaggle_climate.csv for a city-year',
        'example_output': 'data/processed/climate_annual.csv',
        'example_output_row': 'Lucknow,2005, temp_mean:25.42, rainfall_annual:823.4, gdd_accumulation:3729.85, sowing_window_miss:1.0',
    },
    {
        'title': 'Step 3 — Groundwater aggregation',
        'what': 'Samples nearest CGWB wells (50 km) to compute pre/post monsoon depths, depletion, recharge.',
        'command': 'python pipeline/step3_groundwater_aggregate.py',
        'example_input': 'CGWB wells CSV with seasonal columns (May-05, Nov-05)',
        'example_output': 'data/processed/groundwater_annual.csv',
        'example_output_row': 'Ahmedabad,2005, pre_monsoon_depth_mbgl:7.98, post_monsoon_depth_mbgl:2.075, depletion_rate:-1.17',
        'notes': 'Jaipur may use a 5-nearest-well fallback and is flagged via gw_imputed=2.'
    },
    {
        'title': 'Step 4 — FAO GAEZ extraction',
        'what': 'Samples crop-suitability GeoTIFFs at city coords to get baseline suitability class.',
        'command': 'python pipeline/step4_gaez_extract.py',
        'example_input': 'GAEZ GeoTIFF for a crop',
        'example_output': 'data/processed/gaez_baseline.csv',
        'example_output_row': 'Lucknow,gaez_baseline_class:7 (clipped from raw=8)',
    },
    {
        'title': 'Step 5 — Join and feature engineering',
        'what': 'Joins master, climate, groundwater, GAEZ, and Koppen; imputes missing values and makes compound features.',
        'command': 'python pipeline/step5_join_and_features.py',
        'example_input': 'master_index + climate_annual + groundwater_annual + gaez_baseline + koppen_annual',
        'example_output': 'data/processed/vegshift_master.csv',
        'example_output_row': 'Lucknow,2005, gdd_adequate:1, dual_deficit:1, crop_water_deficit:0.4958, cvle_label:1',
        'notes': 'CVLE label rules: two consecutive years of dual_deficit plus 2 of 3 thresholds (sowing miss, water deficit, insufficient GDD).'
    },
    {
        'title': 'Step 6 — TFT training',
        'what': 'Builds TimeSeriesDataSet and trains a Temporal Fusion Transformer on city time series.',
        'command': 'python pipeline/step6_tft_train.py',
        'example_input': 'data/processed/vegshift_master.csv (with time_idx per city)',
        'example_output': 'checkpoint in models/tft/vegshift-tft-best*.ckpt',
        'example_note': 'Model uses 5-year encoder, 1-year prediction horizon; koppen_zone included as time-varying categorical.'
    },
    {
        'title': 'Step 7 — TFT prediction + attention',
        'what': 'Loads checkpoint, predicts CVLE probabilities for validation windows, exports attention weights and CVLE events.',
        'command': 'python pipeline/step7_tft_predict.py',
        'example_input': 'vegshift_master.csv + selected checkpoint',
        'example_output_rows': 'data/output/tft_predictions.csv sample: Delhi,2021,0.0096',
        'example_attention': "Lucknow: [0.20,0.21,0.15,0.22,0.23] (encoder attention average)"
    },
    {
        'title': 'Step 8 — Baselines',
        'what': 'Trains Random Forest, Logistic Regression, and LSTM baselines on the same tabular features and sequence windows.',
        'command': 'python pipeline/step8_baselines.py',
        'example_output': 'models/baselines/rf_baseline.pkl; data/output/baseline_metrics.json',
        'example_metrics': 'RF AUC:1.0, LR AUC:1.0, LSTM AUC:0.846 (note: small/imbalanced test split)',
    },
    {
        'title': 'Step 9 — SHAP explainability',
        'what': 'Computes SHAP values for the RF baseline and summarises global & per-city feature importance.',
        'command': 'python pipeline/step9_shap_explainability.py',
        'example_output': 'data/output/shap_explanation.json (global importance rank example: recharge_efficiency, crop_water_deficit, gdd_accumulation)',
    }
]

# Build a compact textual report
lines = []
for s in steps:
    lines.append(s['title'])
    lines.append('- ' + s.get('what',''))
    lines.append('- Command: ' + s.get('command',''))
    if s.get('example_input'):
        lines.append('  Example input: ' + s['example_input'])
        if 'example_input_row' in s:
            lines.append('  Sample input row: ' + s['example_input_row'])
    if s.get('example_output'):
        lines.append('  Example output: ' + s.get('example_output'))
    if s.get('example_output_row'):
        lines.append('  Sample output row: ' + s['example_output_row'])
    if s.get('example_output_rows'):
        lines.append('  Sample output rows: ' + s['example_output_rows'])
    if s.get('example_attention'):
        lines.append('  Sample attention: ' + s['example_attention'])
    if s.get('example_metrics'):
        lines.append('  Example metrics: ' + s['example_metrics'])
    if s.get('notes'):
        lines.append('  Notes: ' + s['notes'])
    lines.append('\n')

# Add short verification checklist
lines.append('Quick verification steps (what to check after running):')
lines.append('- Ensure data/processed/master_index.csv exists (250 rows).')
lines.append('- Ensure data/processed/kaggle_climate.csv exists and has daily rows.')
lines.append('- Ensure data/processed/vegshift_master.csv has 250 rows and a cvle_label column.')
lines.append('- Check models/tft has at least one vegshift-tft-best checkpoint.')
lines.append('- Check models/baselines contains rf_baseline.pkl and data/output/baseline_metrics.json.')
lines.append('\n')
lines.append('Notes on evaluation and interpretation:')
lines.append('- Many evaluation metrics are unstable due to class imbalance and small positive counts in the hold-out years. Prefer aggregated evaluation over multiple years or cross-validation.')
lines.append('- For probability interpretation, calibrate model outputs (Platt or isotonic) before using a threshold.')
lines.append('\n')
lines.append('Contact: Ask your pipeline owner for dataset provenance or to re-run steps with expanded test windows for robust evaluation.')

# Join into a single text blob and wrap lines
full_text = '\n'.join(lines)
wrapped = '\n'.join(textwrap.wrap(full_text, width=90))

# Split into pages by lines
all_lines = full_text.split('\n')
lines_per_page = 60
pages = [all_lines[i:i+lines_per_page] for i in range(0, len(all_lines), lines_per_page)]

# Build PDF objects
objs = []
content_objs = []
page_objs = []
for p in pages:
    # build content stream for page
    text_lines = ['BT', '/F1 10 Tf', '50 750 Td']
    for li in p:
        safe = escape(li)
        text_lines.append('(' + safe + ') Tj')
        text_lines.append('0 -12 Td')
    text_lines.append('ET')
    stream = '\n'.join(text_lines).encode('utf-8')
    content_objs.append(stream)

# Objects ordering: 1 Font, then Content objects, Page objects, Pages, Catalog
obj_strings = []
obj_offsets = []
next_obj_id = 1

# Font object
font_obj_id = next_obj_id
font_obj = f"{font_obj_id} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
obj_strings.append(font_obj)
next_obj_id += 1

# Content objects
content_obj_ids = []
for stream in content_objs:
    obj_id = next_obj_id
    content_obj_ids.append(obj_id)
    obj_str = f"{obj_id} 0 obj\n<< /Length {len(stream)} >>\nstream\n"
    obj_strings.append(obj_str)
    obj_strings.append(stream)
    obj_strings.append(b"\nendstream\nendobj\n")
    next_obj_id += 1

# Page objects
page_obj_ids = []
for i, cid in enumerate(content_obj_ids):
    pid = next_obj_id
    page_obj_ids.append(pid)
    obj = (f"{pid} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
           f"/Contents {cid} 0 R /Resources << /Font << /F1 {font_obj_id} 0 R >> >> >>\nendobj\n")
    obj_strings.append(obj)
    next_obj_id += 1

# Pages object
pages_obj_id = next_obj_id
kids = ' '.join([f"{pid} 0 R" for pid in page_obj_ids])
pages_obj = f"{pages_obj_id} 0 obj\n<< /Type /Pages /Kids [{kids}] /Count {len(page_obj_ids)} >>\nendobj\n"
obj_strings.append(pages_obj)
next_obj_id += 1

# Catalog object
catalog_obj_id = next_obj_id
catalog_obj = f"{catalog_obj_id} 0 obj\n<< /Type /Catalog /Pages {pages_obj_id} 0 R >>\nendobj\n"
obj_strings.append(catalog_obj)
next_obj_id += 1

# assemble PDF
pdf = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
offsets = []
current = len(pdf)
for part in obj_strings:
    offsets.append(current)
    if isinstance(part, bytes):
        pdf += part
        current += len(part)
    else:
        b = part.encode('utf-8')
        pdf += b
        current += len(b)

# xref
xref_start = len(pdf)
pdf += b"xref\n0 %d\n" % (len(offsets)+1)
pdf += b"0000000000 65535 f \n"
for off in offsets:
    pdf += b"%010d 00000 n \n" % off

# trailer
pdf += b"trailer\n<< /Size %d /Root %d 0 R >>\n" % (len(offsets)+1, catalog_obj_id)
pdf += b"startxref\n%d\n%%%%EOF\n" % xref_start

# write file
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'wb') as f:
    f.write(pdf)

print(f'PDF written to {OUT} (pages: {len(pages)})')
