from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import mm
import os

OUT = 'docs/VegShift_Full_Pipeline_Report_Pretty.pdf'

styles = getSampleStyleSheet()

def add_style_if_missing(sheet, name, **kwargs):
    if name not in sheet.byName:
        sheet.add(ParagraphStyle(name=name, **kwargs))

add_style_if_missing(styles, 'TitleLarge', fontSize=20, leading=24, spaceAfter=10)
add_style_if_missing(styles, 'Heading', fontSize=14, leading=18, spaceAfter=6, textColor=colors.HexColor('#2c3e50'))
add_style_if_missing(styles, 'Code', fontName='Courier', fontSize=9, leading=12)
add_style_if_missing(styles, 'Small', fontSize=9, leading=11)

steps = [
    {
        'title': 'Step 0 — Master Index',
        'what': 'Builds the 10-city × 25-year backbone table used to join all datasets.',
        'command': 'python pipeline/step0_master_index.py',
        'input_examples': ['(hardcoded) cities list and years 2000–2024'],
        'output_examples': [('master_index.csv', 'city,year\nDelhi,2000\nMumbai,2000')],
        'notes': 'Produces data/processed/master_index.csv (250 rows).'
    },
    {
        'title': 'Step 0b — Preprocess raw climate data',
        'what': 'Standardizes daily climate fields; derives humidity where missing; unit conversions.',
        'command': 'python pipeline/step0b_preprocess_datasets.py',
        'input_examples': ['Raw daily CSV: city,date,temperature_2m_max,temperature_2m_min,precipitation_sum'],
        'output_examples': [('kaggle_climate.csv', 'city,date,temp_max,temp_min,temp_mean,rainfall')],
        'sample_input_row': 'Delhi,2000-01-01,32.5,21.1,0.0',
        'sample_output_row': 'Delhi,2000-01-01,32.5,21.1,26.8,0.0',
        'notes': 'Also computes `humidity` using apparent-temperature inversion when missing.'
    },
    {
        'title': 'Step 1 — Koppen-Geiger classification',
        'what': 'Aggregates daily to annual and assigns a Koppen zone per city-year.',
        'command': 'python pipeline/step1_koppen_classification.py',
        'input_examples': ['Annual aggregates: T_ann, P_ann, T_min_month, T_max_month, monthly rainfall series'],
        'output_examples': [('koppen_annual.csv', 'city,year,koppen_zone,koppen_zone_enc')],
        'sample_output_row': 'Delhi,2005,BSh,2'
    },
    {
        'title': 'Step 1b — Transition detection',
        'what': 'Detects persistent changes in Koppen zone (persist >= 3 years).',
        'command': 'python pipeline/step1b_transition_detection.py',
        'input_examples': ['koppen_annual.csv (time series for each city)'],
        'output_examples': [('transition_report.json', '[{city,transition_year,from_zone,to_zone}]')],
        'sample_output_row': "{'city':'Lucknow','transition_year':2007,'from_zone':'Cwa','to_zone':'BSh'}",
    },
    {
        'title': 'Step 2 — Climate feature aggregation',
        'what': 'Computes crop-relevant annual features: monsoon onset, GDD, sowing-window miss, water deficit.',
        'command': 'python pipeline/step2_climate_aggregate.py',
        'input_examples': ['kaggle_climate.csv daily rows for a city-year'],
        'output_examples': [('climate_annual.csv', 'city,year,temp_mean,rainfall_annual,gdd_accumulation,sowing_window_miss')],
        'sample_output_row': 'Lucknow,2005, temp_mean:25.42, rainfall_annual:823.4, gdd_accumulation:3729.85, sowing_window_miss:1.0'
    },
    {
        'title': 'Step 3 — Groundwater aggregation',
        'what': 'Samples nearest CGWB wells (50 km) to compute pre/post monsoon depth, depletion, recharge_efficiency.',
        'command': 'python pipeline/step3_groundwater_aggregate.py',
        'input_examples': ['CGWB CSV with season columns (Jan-YY,May-YY,Aug-YY,Nov-YY)'],
        'output_examples': [('groundwater_annual.csv', 'city,year,pre_monsoon_depth_mbgl,post_monsoon_depth_mbgl,depletion_rate,recharge_efficiency')],
        'sample_output_row': 'Ahmedabad,2005, pre_monsoon_depth_mbgl:7.98, post_monsoon_depth_mbgl:2.075, depletion_rate:-1.17',
        'notes': 'Jaipur uses a nearest-well fallback and is flagged with gw_imputed=2.'
    },
    {
        'title': 'Step 4 — FAO GAEZ extraction',
        'what': 'Samples raster suitability for the city coordinate and maps to ECOCROP thresholds.',
        'command': 'python pipeline/step4_gaez_extract.py',
        'input_examples': ['GAEZ GeoTIFF per crop'],
        'output_examples': [('gaez_baseline.csv', 'city,gaez_baseline_class,gdd_min,water_req')],
        'sample_output_row': 'Lucknow, gaez_baseline_class:7 (clipped from 8), gdd_min:2500, water_req:1500'
    },
    {
        'title': 'Step 5 — Join + Features + CVLE labels',
        'what': 'Joins processed tables, imputes missing values, creates compound features and the CVLE label.',
        'command': 'python pipeline/step5_join_and_features.py',
        'input_examples': ['master_index + climate_annual + groundwater_annual + gaez_baseline + koppen_annual'],
        'output_examples': [('vegshift_master.csv', 'master table with features + cvle_label')],
        'sample_output_row': 'Lucknow,2005, dual_deficit:1, gdd_adequate:1, cvle_label:1',
        'notes': 'CVLE rule: consecutive dual_deficit years + at least 2 of 3 thresholds (sow_miss>0.6, water_deficit>0.4, gdd inadequate).'
    },
    {
        'title': 'Step 6 — TFT Training',
        'what': 'Prepares TimeSeriesDataSet (encoder_len=5) and trains a Temporal Fusion Transformer; saves best checkpoint.',
        'command': 'python pipeline/step6_tft_train.py',
        'input_examples': ['vegshift_master.csv with `time_idx` per city'],
        'output_examples': [('models/tft/vegshift-tft-best-VERSION.ckpt', 'trained checkpoint')],
        'notes': 'Uses quantile loss and outputs a quantile ensemble (7 quantiles).'
    },
    {
        'title': 'Step 7 — TFT Predict + Attention',
        'what': 'Loads best checkpoint, predicts CVLE probabilities for validation windows, extracts attention weights.',
        'command': 'python pipeline/step7_tft_predict.py --checkpoint models/tft/vegshift-tft-best.ckpt',
        'input_examples': ['vegshift_master.csv + checkpoint'],
        'output_examples': [('tft_predictions.csv', 'city,year,predicted_cvle_score'), ('tft_attention_weights.json','city:[5-lag weights]')],
        'sample_output_row': 'Delhi,2021,0.0096',
        'sample_attention': "Lucknow: [0.20,0.21,0.15,0.22,0.23]"
    },
    {
        'title': 'Step 8 — Baselines',
        'what': 'Trains Random Forest, Logistic Regression, and an LSTM sequence baseline; saves models and metrics.',
        'command': 'python pipeline/step8_baselines.py',
        'input_examples': ['vegshift_master.csv'],
        'output_examples': [('models/baselines/*.pkl, *.pt', 'data/output/baseline_metrics.json')],
        'sample_metrics': "RF AUC:1.0, LR AUC:1.0, LSTM AUC:0.846 (test split small/imbalanced)"
    },
    {
        'title': 'Step 9 — SHAP Explainability',
        'what': 'Computes SHAP values for the RF baseline and exports global + per-city feature importance.',
        'command': 'python pipeline/step9_shap_explainability.py',
        'input_examples': ['vegshift_master.csv', 'models/baselines/rf_baseline.pkl', 'scaler.pkl'],
        'output_examples': [('data/output/shap_explanation.json', 'global and per-city importance lists')],
        'sample_output_row': "global_importance top: ['recharge_efficiency','crop_water_deficit','gdd_accumulation']"
    }
]

# Build document
os.makedirs(os.path.dirname(OUT), exist_ok=True)
doc = SimpleDocTemplate(OUT, pagesize=A4,
                        rightMargin=20*mm,leftMargin=20*mm,
                        topMargin=20*mm,bottomMargin=20*mm)
flow = []

flow.append(Paragraph('VegShift — Detailed Pipeline Guide (Steps 0–9)', styles['TitleLarge']))
flow.append(Paragraph('Comprehensive step-by-step breakdown with example inputs, outputs, commands and notes. Shareable PDF for teammates.', styles['Small']))
flow.append(Spacer(1,12))

# Table of contents
flow.append(Paragraph('Contents', styles['Heading']))
for i, s in enumerate(steps, start=1):
    flow.append(Paragraph(f'{i}. {s["title"]}', styles['Small']))
flow.append(PageBreak())

# Detailed steps
for i, s in enumerate(steps, start=1):
    flow.append(Paragraph(f'{i}. {s["title"]}', styles['Heading']))
    flow.append(Paragraph(s['what'], styles['Small']))
    flow.append(Spacer(1,6))
    flow.append(Paragraph('<b>Command</b>: <i>%s</i>' % s.get('command',''), styles['Small']))
    flow.append(Spacer(1,6))
    # Inputs
    flow.append(Paragraph('<b>Inputs</b>:', styles['Small']))
    for inp in s.get('input_examples', []):
        flow.append(Paragraph(f'• {inp}', styles['Code']))
    flow.append(Spacer(1,6))
    # Input sample row
    if s.get('sample_input_row'):
        flow.append(Paragraph('<b>Sample input row</b>:', styles['Small']))
        flow.append(Paragraph(s['sample_input_row'], styles['Code']))
        flow.append(Spacer(1,6))
    # Outputs
    flow.append(Paragraph('<b>Outputs</b>:', styles['Small']))
    data = s.get('output_examples', [])
    if data:
        table_data = [['File', 'Description / Example']]
        for fname, desc in data:
            table_data.append([fname, desc])
        t = Table(table_data, colWidths=[80*mm, 80*mm])
        t.setStyle(TableStyle([
            ('BACKGROUND',(0,0),(1,0),colors.HexColor('#2c3e50')),
            ('TEXTCOLOR',(0,0),(1,0),colors.white),
            ('GRID',(0,0),(-1,-1),0.25,colors.grey),
            ('BACKGROUND',(0,1),(-1,-1),colors.whitesmoke)
        ]))
        flow.append(t)
        flow.append(Spacer(1,6))
    # Sample output row
    if s.get('sample_output_row'):
        flow.append(Paragraph('<b>Sample output row</b>:', styles['Small']))
        flow.append(Paragraph(s['sample_output_row'], styles['Code']))
        flow.append(Spacer(1,6))
    if s.get('sample_output_rows'):
        flow.append(Paragraph('<b>Sample output rows</b>:', styles['Small']))
        flow.append(Paragraph(s['sample_output_rows'], styles['Code']))
        flow.append(Spacer(1,6))
    if s.get('sample_attention'):
        flow.append(Paragraph('<b>Sample attention</b>:', styles['Small']))
        flow.append(Paragraph(s['sample_attention'], styles['Code']))
        flow.append(Spacer(1,6))
    if s.get('sample_metrics'):
        flow.append(Paragraph('<b>Example metrics</b>:', styles['Small']))
        flow.append(Paragraph(s['sample_metrics'], styles['Code']))
        flow.append(Spacer(1,6))
    if s.get('notes'):
        flow.append(Paragraph('<b>Notes</b>:', styles['Small']))
        flow.append(Paragraph(s['notes'], styles['Small']))
        flow.append(Spacer(1,6))
    flow.append(PageBreak())

# Verification and evaluation notes
flow.append(Paragraph('Verification Checklist', styles['Heading']))
flow.append(Paragraph('- data/processed/master_index.csv present (250 rows)', styles['Small']))
flow.append(Paragraph('- data/processed/kaggle_climate.csv present and daily', styles['Small']))
flow.append(Paragraph('- data/processed/vegshift_master.csv includes `cvle_label`', styles['Small']))
flow.append(Paragraph('- models/tft contains at least one best checkpoint', styles['Small']))
flow.append(Paragraph('- models/baselines contains RF/LR/LSTM and data/output/baseline_metrics.json', styles['Small']))
flow.append(Spacer(1,8))
flow.append(Paragraph('Evaluation notes', styles['Heading']))
flow.append(Paragraph('• The dataset is imbalanced; prefer PR-AUC and aggregated evaluation over multiple years or cross-validation.', styles['Small']))
flow.append(Paragraph('• Calibrate model probabilities before picking operational thresholds.', styles['Small']))
flow.append(Spacer(1,12))
flow.append(Paragraph('Contact: pipeline owner for dataset provenance or to request extended evaluation windows.', styles['Small']))

# Build PDF

doc.build(flow)
print('Pretty PDF written to', OUT)
