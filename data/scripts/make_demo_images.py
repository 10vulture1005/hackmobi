#!/usr/bin/env python3
"""Generates the demo prescription images as SVG.

These are synthetic documents for the demo: a fictional clinic, a fictional
doctor and a visible DEMO watermark, so nothing here imitates a real
prescription or a real prescriber.
"""
import os

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'demo')
os.makedirs(OUT, exist_ok=True)

SLIPS = [
    ("prescription-fever", "Demo Clinic", "Indira Nagar, Lucknow", "Dr. A. K. Verma (demo)",
     "Reg. UPMC/DEMO/48213", "Patient: Sunita Devi, 34 F", [
         "Tab. Dolo 650        1-0-1  x 3 days",
         "Tab. Augmentin 625 Duo  1-0-1  x 5 days",
         "Syp. Ascoril D Plus   100 ml",
         "Steam inhalation, warm water gargle",
     ]),
    ("prescription-chronic", "Demo Diabetes Care", "Gomti Nagar, Lucknow", "Dr. S. Mishra (demo)",
     "Reg. UPMC/DEMO/31904", "Patient: Ramesh Yadav, 58 M", [
         "Tab. Glycomet 500     1-0-1  x 30 days",
         "Tab. Amlopres 5       1-0-0  x 30 days",
         "Tab. Atorva 10        0-0-1  x 30 days",
         "Review after 1 month with FBS, PPBS",
     ]),
    ("prescription-thyroid", "Demo Endocrine Clinic", "Hazratganj, Lucknow", "Dr. N. Bajpai (demo)",
     "Reg. UPMC/DEMO/22510", "Patient: Asha Srivastava, 41 F", [
         "Tab. Thyronorm 50 mcg   1-0-0  empty stomach",
         "Tab. Shelcal 500        0-0-1",
         "Repeat TSH after 8 weeks",
     ]),
    ("prescription-duplicate", "Demo Polyclinic", "Alambagh, Lucknow", "Dr. R. Saxena (demo)",
     "Reg. UPMC/DEMO/77431", "Patient: Imran Khan, 29 M", [
         "Tab. Combiflam       1-1-1  x 3 days",
         "Tab. Dolo 650        SOS for fever",
         "Tab. Pan 40          1-0-0  before food",
     ]),
    ("prescription-otc", "Demo Family Clinic", "Aliganj, Lucknow", "Dr. P. Khan (demo)",
     "Reg. UPMC/DEMO/58120", "Patient: Kavita Singh, 26 F", [
         "Tab. Alerid 10        0-0-1  x 5 days",
         "Tab. Crocin Advance 500   SOS",
         "Avoid dust, use a mask outdoors",
     ]),
]

TEMPLATE = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 820" width="640" height="820" role="img" aria-label="Demo prescription">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fffdf7"/>
      <stop offset="100%" stop-color="#f6f1e6"/>
    </linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="0.4"/></filter>
  </defs>
  <rect width="640" height="820" fill="url(#paper)"/>
  <rect x="0" y="0" width="640" height="6" fill="#0f766e"/>
  {lines}
  <text x="320" y="470" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="88" font-weight="700" fill="#0f766e" opacity="0.08" transform="rotate(-24 320 470)">DEMO</text>
  <text x="40" y="786" font-family="Helvetica,Arial,sans-serif" font-size="12" fill="#8a8578">Synthetic demo document — not a real prescription. Fictional clinic and prescriber.</text>
</svg>
"""


def text(x, y, s, size=16, weight='400', fill='#1c2b2a', family='Helvetica,Arial,sans-serif', anchor='start', style=''):
    esc = s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    st = f' font-style="{style}"' if style else ''
    return (f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}" font-weight="{weight}" '
            f'fill="{fill}" text-anchor="{anchor}"{st}>{esc}</text>')


SCRIPT_FONT = "'Segoe Script','Bradley Hand','Comic Sans MS',cursive"

for slug, clinic, addr, doctor, reg, patient, items in SLIPS:
    L = []
    L.append(text(40, 56, clinic, 26, '700', '#0f766e'))
    L.append(text(40, 78, addr, 14, '400', '#6b7572'))
    L.append(text(600, 56, doctor, 15, '700', '#1c2b2a', anchor='end'))
    L.append(text(600, 76, reg, 12, '400', '#6b7572', anchor='end'))
    L.append(f'<line x1="40" y1="96" x2="600" y2="96" stroke="#d6d0c2" stroke-width="1.5"/>')
    L.append(text(40, 126, patient, 15, '600'))
    L.append(text(600, 126, 'Date: __ / __ / ____', 14, '400', '#6b7572', anchor='end'))
    L.append(text(40, 182, 'Rx', 44, '700', '#0f766e', family=SCRIPT_FONT))
    y = 230
    for line in items:
        L.append(text(96, y, line, 21, '400', '#17307a', family=SCRIPT_FONT))
        y += 52
    L.append(f'<line x1="380" y1="700" x2="600" y2="700" stroke="#b9b2a2" stroke-width="1.2"/>')
    L.append(text(600, 724, 'Signature / Stamp', 12, '400', '#8a8578', anchor='end'))
    L.append(text(490, 686, doctor.split(' (')[0], 20, '400', '#17307a', family=SCRIPT_FONT, anchor='middle'))
    svg = TEMPLATE.format(lines='\n  '.join(L))
    with open(os.path.join(OUT, f'{slug}.svg'), 'w') as f:
        f.write(svg)
    print('wrote', slug)
