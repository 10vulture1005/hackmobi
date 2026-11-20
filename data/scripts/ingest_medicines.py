#!/usr/bin/env python3
"""Ingest the Indian medicine master dataset into data/seed/products.json.

    # 1. download a dataset manually (Kaggle login required) into data/raw/
    #    e.g. "A-Z Medicine Dataset of India" (~11k rows)
    # 2. then:
    python3 data/scripts/ingest_medicines.py data/raw/A_Z_medicines_dataset_of_india.csv
    python3 data/scripts/ingest_medicines.py data/raw/medicines.csv --limit 15000 --keep-janaushadhi

Column names vary between the public dumps, so they are matched by alias rather
than by position. Anything this script cannot parse confidently gets
canonical_key = null, which means the app will show it but never offer or accept
it as a substitute. That is the intended behaviour: a wrong substitution is far
worse than a missing one.

The canonical-key rules here mirror lib/engine/canonical.ts exactly. If you
change one, change the other and run `npm test` — the TypeScript suite is the
specification for both.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SEED = os.path.join(ROOT, 'data', 'seed')
SCHEMES = os.path.join(ROOT, 'data', 'schemes')

ALIASES = {
    'name': ('name', 'medicine_name', 'brand_name', 'product_name', 'medicine'),
    'price': ('price(₹)', 'price', 'mrp', 'price_inr', 'rate'),
    'manufacturer': ('manufacturer_name', 'manufacturer', 'company', 'marketer'),
    'pack': ('pack_size_label', 'pack_size', 'packaging', 'pack'),
    'comp1': ('short_composition1', 'composition1', 'salt_composition', 'composition'),
    'comp2': ('short_composition2', 'composition2'),
    'rx': ('is_discontinued', 'prescription', 'rx_required', 'type'),
}

UNIT_CANON = {
    'g': ('mg', 1000.0), 'gm': ('mg', 1000.0), 'gms': ('mg', 1000.0),
    'mg': ('mg', 1.0), 'mgs': ('mg', 1.0),
    'mcg': ('mcg', 1.0), 'ug': ('mcg', 1.0), 'µg': ('mcg', 1.0),
    'iu': ('iu', 1.0), 'unit': ('iu', 1.0), 'units': ('iu', 1.0),
    'ml': ('ml', 1.0), '%': ('%', 1.0), 'w/v': ('%', 1.0), 'w/w': ('%', 1.0),
}

FORM_TOKENS = [
    (r'\b(suspensions?|dry syrup|oral suspension)\b', 'suspension'),
    (r'\b(tablets?|tabs?|dt|caplet)\b', 'tablet'),
    (r'\b(capsules?|caps?)\b', 'capsule'),
    (r'\bsyrups?\b', 'syrup'),
    (r'\b(injections?|inj|vial|ampoule|infusion)\b', 'injection'),
    (r'\bcreams?\b', 'cream'),
    (r'\b(ointments?|gel)\b', 'ointment'),
    (r'\b(drops?|eye drop|ear drop|nasal spray)\b', 'drops'),
    (r'\b(inhalers?|rotacaps?|respules?|mdi)\b', 'inhaler'),
]
ER_TOKENS = r'\b(sr|xr|er|cr|mr|xl|la|od|retard|extended[- ]release|sustained[- ]release|modified[- ]release|controlled[- ]release)\b'
STRENGTH_RE = re.compile(r'(\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|ug|gms|gm|g|ml|iu|i\.u\.?|%)(?![a-z0-9])', re.I)
PACK_RE = re.compile(r'(\d+(?:\.\d+)?)\s*(tablet|capsule|ml|gm|g|dose|piece|sachet)', re.I)

# Mirrors SALT_SYNONYMS in lib/engine/canonical.ts. Salt-form suffixes are only
# ever stripped through this table, never by a generic rule.
SYNONYMS = {
    'acetaminophen': 'paracetamol', 'paracetamol ip': 'paracetamol',
    'amoxycillin': 'amoxicillin', 'amoxycillin trihydrate': 'amoxicillin',
    'amoxicillin trihydrate': 'amoxicillin', 'potassium clavulanate': 'clavulanic acid',
    'vitamin d3': 'cholecalciferol', 'vitamin d': 'cholecalciferol',
    'vitamin b12': 'cyanocobalamin', 'vitamin c': 'ascorbic acid',
    'metformin hydrochloride': 'metformin', 'metformin hcl': 'metformin',
    'amlodipine besylate': 'amlodipine', 'amlodipine besilate': 'amlodipine',
    'atorvastatin calcium': 'atorvastatin', 'rosuvastatin calcium': 'rosuvastatin',
    'cetirizine hydrochloride': 'cetirizine', 'cetirizine dihydrochloride': 'cetirizine',
    'levocetirizine dihydrochloride': 'levocetirizine', 'pantoprazole sodium': 'pantoprazole',
    'pantoprazole sodium sesquihydrate': 'pantoprazole', 'omeprazole magnesium': 'omeprazole',
    'esomeprazole magnesium': 'esomeprazole', 'rabeprazole sodium': 'rabeprazole',
    'diclofenac sodium': 'diclofenac', 'diclofenac potassium': 'diclofenac',
    'azithromycin dihydrate': 'azithromycin', 'ciprofloxacin hydrochloride': 'ciprofloxacin',
    'levofloxacin hemihydrate': 'levofloxacin', 'cefixime trihydrate': 'cefixime',
    'losartan potassium': 'losartan', 'levothyroxine sodium': 'levothyroxine',
    'thyroxine sodium': 'levothyroxine', 'warfarin sodium': 'warfarin',
    'phenytoin sodium': 'phenytoin', 'sodium valproate': 'valproate',
    'valproic acid': 'valproate', 'lithium carbonate': 'lithium',
    'sitagliptin phosphate': 'sitagliptin', 'salbutamol sulphate': 'salbutamol',
    'salbutamol sulfate': 'salbutamol', 'albuterol': 'salbutamol',
    'montelukast sodium': 'montelukast', 'ondansetron hydrochloride': 'ondansetron',
    'domperidone maleate': 'domperidone', 'dicyclomine hydrochloride': 'dicyclomine',
    'tramadol hydrochloride': 'tramadol', 'chlorpheniramine maleate': 'chlorpheniramine',
    'cpm': 'chlorpheniramine', 'phenylephrine hydrochloride': 'phenylephrine',
    'dextromethorphan hydrobromide': 'dextromethorphan', 'ambroxol hydrochloride': 'ambroxol',
    'hydroxychloroquine sulphate': 'hydroxychloroquine', 'povidone-iodine': 'povidone iodine',
    'cyclosporine': 'ciclosporin', 'cyclosporin': 'ciclosporin',
}


def column(fieldnames: list[str], key: str) -> str | None:
    lowered = {f.lower().strip(): f for f in fieldnames}
    for alias in ALIASES[key]:
        if alias in lowered:
            return lowered[alias]
    return None


def canon_salt(raw: str) -> str:
    name = re.sub(r'\(.*?\)', ' ', raw.lower())
    name = re.sub(r'\b(ip|usp|bp|eq\.? to|equivalent to)\b', ' ', name)
    name = re.sub(r'[^a-z0-9\s/-]', ' ', name)
    name = re.sub(r'\s+', ' ', name).strip()
    if name in SYNONYMS:
        return SYNONYMS[name]
    for key, value in SYNONYMS.items():
        if name.startswith(key + ' '):
            return value
    return name


def norm_form(raw: str, name_hint: str = '') -> str:
    text = f'{raw} {name_hint}'.lower()
    base = 'other'
    for pattern, form in FORM_TOKENS:
        if re.search(pattern, text):
            base = form
            break
    if base in ('tablet', 'capsule') and re.search(ER_TOKENS, text):
        return f'{base}_er'
    return base


def parse_composition(raw: str) -> tuple[list[dict], float]:
    text = (raw or '').replace(' ', ' ').strip()
    if not text:
        return [], 0.0
    parts = [p.strip() for p in re.split(r'\s*(?:\+|,(?!\d)|\band\b|&)\s*', text, flags=re.I) if p.strip()]
    salts: list[dict] = []
    missing = 0
    for part in parts:
        m = STRENGTH_RE.search(part)
        salt = canon_salt(STRENGTH_RE.sub(' ', part) if m else part)
        if not salt or len(salt) < 3:
            continue
        if m:
            value = float(m.group(1).replace(',', '.'))
            unit, factor = UNIT_CANON.get(m.group(2).lower().replace('.', ''), (m.group(2).lower(), 1.0))
            salts.append({'salt': salt, 'strength': value * factor, 'unit': unit})
        else:
            missing += 1
            salts.append({'salt': salt, 'strength': None, 'unit': None})
    if not salts:
        return [], 0.0
    confidence = 1.0
    if missing:
        confidence -= 0.4 * (missing / len(salts)) + 0.2
    if len(salts) > 4:
        confidence -= 0.2
    if any(re.search(r'\b(extract|others?|etc|excipients?)\b', s['salt']) for s in salts):
        confidence -= 0.5
    return salts, max(0.0, min(1.0, confidence))


def fmt(n: float) -> str:
    return str(int(n)) if float(n).is_integer() else str(round(n, 4))


def canonical_key(salts: list[dict], form: str, confidence: float) -> str | None:
    usable = (
        salts
        and confidence >= 0.75
        and all(s['strength'] is not None and s['unit'] for s in salts)
        and form != 'other'
    )
    if not usable:
        return None
    ordered = sorted(salts, key=lambda s: s['salt'])
    return '|'.join(f"{s['salt']}:{fmt(s['strength'])}{s['unit']}" for s in ordered) + f'|{form}'


def load_schedules() -> dict[str, set[str]]:
    with open(os.path.join(SCHEMES, 'rx_schedule.json')) as f:
        data = json.load(f)
    return {k: {s.lower() for s in v} for k, v in data.items() if k in ('X', 'H1', 'H', 'OTC')}


def schedule_for(salts: list[dict], lists: dict[str, set[str]]) -> str:
    """Fail closed: anything we cannot classify is prescription-only."""
    if not salts:
        return 'H'
    names = [s['salt'].lower() for s in salts]
    for level in ('X', 'H1', 'H'):
        if any(n in lists[level] for n in names):
            return level
    return 'OTC' if all(n in lists['OTC'] for n in names) else 'H'


def pack_size(label: str, form: str) -> tuple[int, str]:
    m = PACK_RE.search(label or '')
    unit = {
        'tablet': 'tablet', 'tablet_er': 'tablet', 'capsule': 'capsule', 'capsule_er': 'capsule',
        'syrup': 'ml', 'suspension': 'ml', 'drops': 'ml', 'injection': 'ml',
        'cream': 'g', 'ointment': 'g', 'inhaler': 'dose',
    }.get(form, 'unit')
    if m:
        return max(1, int(float(m.group(1)))), unit
    return (1, unit)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('csv_path')
    ap.add_argument('--out', default=os.path.join(SEED, 'products.json'))
    ap.add_argument('--limit', type=int, default=15000, help='cap rows for a free DB tier')
    ap.add_argument('--keep-janaushadhi', action='store_true',
                    help='merge the existing Jan Aushadhi rows from data/seed/products.json')
    args = ap.parse_args()

    lists = load_schedules()
    products: list[dict] = []
    skipped_no_key = 0
    skipped_bad_price = 0

    with open(args.csv_path, newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            print('empty CSV', file=sys.stderr)
            return 1
        cols = {k: column(reader.fieldnames, k) for k in ALIASES}
        if not cols['name'] or not cols['comp1']:
            print(f'could not find name/composition columns in {reader.fieldnames}', file=sys.stderr)
            return 1
        print(f'Columns: {cols}')

        for i, row in enumerate(reader):
            if len(products) >= args.limit:
                break
            name = (row.get(cols['name']) or '').strip()
            if not name:
                continue
            try:
                mrp = float(re.sub(r'[^0-9.]', '', row.get(cols['price']) or '') or 0)
            except ValueError:
                mrp = 0.0
            if mrp <= 0:
                skipped_bad_price += 1
                continue

            comp = ' + '.join(
                c for c in ((row.get(cols['comp1']) or ''), (row.get(cols['comp2']) or '')) if c.strip()
            )
            form = norm_form(row.get(cols['pack']) or '', name)
            salts, confidence = parse_composition(comp)
            key = canonical_key(salts, form, confidence)
            if key is None:
                skipped_no_key += 1
            size, unit_label = pack_size(row.get(cols['pack']) or '', form)
            schedule = schedule_for(salts, lists)

            products.append({
                'id': f'p{i + 1:06d}',
                'brand_name': name,
                'manufacturer': (row.get(cols['manufacturer']) or '').strip() or 'Unknown',
                'composition_raw': comp,
                'salts': [
                    {'salt': s['salt'], 'strength': s['strength'], 'unit': s['unit']} for s in sorted(salts, key=lambda s: s['salt'])
                ],
                'dosage_form': form,
                'canonical_key': key,
                'pack_size': size,
                'unit_label': unit_label,
                'mrp': round(mrp, 2),
                'price_per_unit': round(mrp / size, 4),
                'is_generic': False,
                'is_jan_aushadhi': False,
                'is_rx': schedule != 'OTC',
                'schedule': schedule,
                'nppa_ceiling_per_unit': None,
                'source': os.path.basename(args.csv_path),
            })

    if args.keep_janaushadhi and os.path.exists(args.out):
        with open(args.out) as f:
            existing = json.load(f)
        ja = [p for p in existing if p.get('is_jan_aushadhi')]
        products.extend(ja)
        print(f'  kept {len(ja)} Jan Aushadhi rows')

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, 'w') as f:
        json.dump(products, f)

    keyed = sum(1 for p in products if p['canonical_key'])
    groups: dict[str, int] = {}
    for p in products:
        if p['canonical_key']:
            groups[p['canonical_key']] = groups.get(p['canonical_key'], 0) + 1
    substitutable = sum(1 for v in groups.values() if v > 1)

    print(f'\nWrote {len(products)} products to {args.out}')
    print(f'  canonical key set     {keyed}/{len(products)}')
    print(f'  canonical medicines   {len(groups)} ({substitutable} with at least one substitute)')
    print(f'  prescription-only     {sum(1 for p in products if p["is_rx"])}')
    print(f'  skipped (no price)    {skipped_bad_price}')
    print(f'  no key (not substitutable, shown anyway)  {skipped_no_key}')
    print('\nNext: python3 data/scripts/ingest_nppa.py   # then npx tsx data/scripts/seed_all.ts --pharmacies-from-seed')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
