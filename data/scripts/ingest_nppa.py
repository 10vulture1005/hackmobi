#!/usr/bin/env python3
"""Map NPPA ceiling prices onto products, by canonical key.

    # download an NPPA ceiling-price list (NLEM) as CSV into data/raw/ first
    python3 data/scripts/ingest_nppa.py data/raw/nppa_ceiling_prices.csv

Expected columns (matched by alias, any order):
    formulation | name | drug      -> the salt and strength text
    strength                        -> optional, if published separately
    unit | pack                     -> optional unit text
    ceiling_price | price | ceiling -> ceiling price PER UNIT (tablet/capsule/ml)

Only exact canonical-key matches are written. A ceiling attached to the wrong
strength would produce a false "overpriced" accusation against a real pharmacy,
so an ambiguous row is skipped and reported instead of being guessed.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ingest_medicines import canonical_key, norm_form, parse_composition  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SEED = os.path.join(ROOT, 'data', 'seed')

NAME_COLS = ('formulation', 'name', 'drug', 'medicine', 'product')
PRICE_COLS = ('ceiling_price', 'ceiling price', 'price', 'ceiling', 'ceiling_price_per_unit')
FORM_COLS = ('dosage_form', 'form', 'unit', 'pack', 'packing')


def pick(fieldnames: list[str], options: tuple[str, ...]) -> str | None:
    lowered = {f.lower().strip(): f for f in fieldnames}
    for option in options:
        if option in lowered:
            return lowered[option]
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('csv_path')
    ap.add_argument('--products', default=os.path.join(SEED, 'products.json'))
    args = ap.parse_args()

    with open(args.products) as f:
        products = json.load(f)

    ceilings: dict[str, float] = {}
    ambiguous = 0
    unparsed = 0

    with open(args.csv_path, newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            print('empty CSV', file=sys.stderr)
            return 1
        name_col = pick(reader.fieldnames, NAME_COLS)
        price_col = pick(reader.fieldnames, PRICE_COLS)
        form_col = pick(reader.fieldnames, FORM_COLS)
        if not name_col or not price_col:
            print(f'need a formulation column and a ceiling price column; saw {reader.fieldnames}', file=sys.stderr)
            return 1

        for row in reader:
            text = (row.get(name_col) or '').strip()
            try:
                price = float(re.sub(r'[^0-9.]', '', row.get(price_col) or '') or 0)
            except ValueError:
                price = 0.0
            if not text or price <= 0:
                unparsed += 1
                continue
            salts, confidence = parse_composition(text)
            form = norm_form(row.get(form_col) or '', text)
            key = canonical_key(salts, form, confidence)
            if key is None:
                unparsed += 1
                continue
            if key in ceilings and abs(ceilings[key] - price) > 0.01:
                # Two different ceilings for the same canonical medicine: keep the
                # lower one, since that is the binding limit, and report it.
                ambiguous += 1
                ceilings[key] = min(ceilings[key], price)
            else:
                ceilings[key] = price

    matched = 0
    for product in products:
        key = product.get('canonical_key')
        if key and key in ceilings:
            product['nppa_ceiling_per_unit'] = round(ceilings[key], 4)
            matched += 1

    with open(args.products, 'w') as f:
        json.dump(products, f)

    over = sum(
        1 for p in products
        if p.get('nppa_ceiling_per_unit') and p['price_per_unit'] > p['nppa_ceiling_per_unit']
    )
    print(f'Ceilings parsed      {len(ceilings)}')
    print(f'Products updated     {matched}/{len(products)}')
    print(f'Above ceiling (flagged in the UI)  {over}')
    print(f'Skipped rows         {unparsed} unparsed, {ambiguous} conflicting')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
