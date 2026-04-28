from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Preformatted
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import mm
import re

IN_MD = 'docs/VegShift_Steps_0-9_Detailed.md'
OUT_PDF = 'docs/VegShift_Steps_0-9_Detailed.pdf'

styles = getSampleStyleSheet()

def add_style_if_missing(sheet, name, **kwargs):
    if name not in sheet.byName:
        sheet.add(ParagraphStyle(name=name, **kwargs))

add_style_if_missing(styles, 'TitleLarge', fontSize=18, leading=22, spaceAfter=8)
add_style_if_missing(styles, 'H1', fontSize=14, leading=18, spaceAfter=6, textColor=colors.HexColor('#2c3e50'))
add_style_if_missing(styles, 'H2', fontSize=12, leading=16, spaceAfter=4, textColor=colors.HexColor('#2c3e50'))
add_style_if_missing(styles, 'Code', fontName='Courier', fontSize=9, leading=12)
add_style_if_missing(styles, 'NormalSmall', fontSize=10, leading=12)

flow = []

with open(IN_MD, 'r', encoding='utf-8') as f:
    lines = f.readlines()

in_code = False
code_block = []
for raw in lines:
    line = raw.rstrip('\n')
    if line.strip().startswith('```'):
        if not in_code:
            in_code = True
            code_block = []
        else:
            # close code
            in_code = False
            flow.append(Preformatted('\n'.join(code_block), styles['Code']))
            flow.append(Spacer(1,6))
        continue
    if in_code:
        code_block.append(line)
        continue

    # Headings
    if re.match(r'^\*\*VegShift', line):
        # title line
        txt = re.sub(r'^\*\*', '', line).strip()
        flow.append(Paragraph(txt.replace('**',''), styles['TitleLarge']))
        flow.append(Spacer(1,6))
        continue
    if line.startswith('**') and line.endswith('**') and len(line) < 60:
        # bold heading
        txt = line.strip('*')
        flow.append(Paragraph(txt, styles['H1']))
        continue
    if line.startswith('- **Purpose:**'):
        txt = line.replace('- **Purpose:**', '<b>Purpose:</b>')
        flow.append(Paragraph(txt, styles['NormalSmall']))
        continue
    if line.startswith('- **Script:**'):
        txt = line.replace('- **Script:**', '<b>Script:</b>')
        flow.append(Paragraph(txt, styles['NormalSmall']))
        continue
    if line.startswith('- **Command:**'):
        txt = line.replace('- **Command:**', '<b>Command:</b>')
        flow.append(Paragraph(txt, styles['NormalSmall']))
        continue
    if line.startswith('- **Inputs:**'):
        txt = line.replace('- **Inputs:**', '<b>Inputs:</b>')
        flow.append(Paragraph(txt, styles['NormalSmall']))
        continue
    if line.startswith('- **Outputs:**'):
        txt = line.replace('- **Outputs:**', '<b>Outputs:</b>')
        flow.append(Paragraph(txt, styles['NormalSmall']))
        continue
    if line.startswith('- **Key operations:**'):
        flow.append(Paragraph('<b>Key operations:</b>', styles['NormalSmall']))
        continue
    if re.match(r'^\s{2,}[-*] ', raw):
        # list item
        item = raw.strip()[2:]
        flow.append(Paragraph('• ' + item, styles['NormalSmall']))
        continue
    if line.startswith('- **Sample output row:**') or line.startswith('- **Sample input row:**'):
        key, val = line.split(':',1)
        flow.append(Paragraph(f'<b>{key.strip("- ")}</b>:' + val, styles['Code']))
        continue
    if line.strip() == '':
        flow.append(Spacer(1,6))
        continue
    # Generic paragraph
    flow.append(Paragraph(line.replace('<','&lt;').replace('>','&gt;'), styles['NormalSmall']))

# Build PDF
from reportlab.platypus import SimpleDocTemplate

doc = SimpleDocTemplate(OUT_PDF, pagesize=A4,
                        rightMargin=20*mm,leftMargin=20*mm,
                        topMargin=20*mm,bottomMargin=20*mm)

doc.build(flow)
print('Wrote', OUT_PDF)
