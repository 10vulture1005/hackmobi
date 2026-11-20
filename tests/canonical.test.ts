import { describe, expect, it } from 'vitest'
import type { Product } from '@/lib/engine/types'
import {
  canonicalKey,
  canonicaliseSaltName,
  normaliseForm,
  normaliseUnit,
  parseComposition,
  saltIdentityKey,
} from '@/lib/engine/canonical'
import { search } from '@/lib/engine/match'

const key = (comp: string, form?: string, hint = '') => canonicalKey(comp, form, hint).key

describe('salt name canonicalisation', () => {
  it('maps acetaminophen to paracetamol', () => {
    expect(canonicaliseSaltName('Acetaminophen')).toBe('paracetamol')
  })
  it('maps amoxycillin spelling to amoxicillin', () => {
    expect(canonicaliseSaltName('Amoxycillin')).toBe('amoxicillin')
  })
  it('maps vitamin d3 to cholecalciferol', () => {
    expect(canonicaliseSaltName('Vitamin D3')).toBe('cholecalciferol')
  })
  it('strips the hydrochloride suffix only via the explicit map', () => {
    expect(canonicaliseSaltName('Metformin Hydrochloride')).toBe('metformin')
  })
  it('keeps metoprolol salt forms distinct', () => {
    expect(canonicaliseSaltName('Metoprolol Succinate')).not.toBe(
      canonicaliseSaltName('Metoprolol Tartrate'),
    )
  })
  it('drops pharmacopoeia markers', () => {
    expect(canonicaliseSaltName('Paracetamol IP')).toBe('paracetamol')
  })
  it('handles a synonym written with a trailing qualifier', () => {
    expect(canonicaliseSaltName('Metformin HCl IP')).toBe('metformin')
  })
  it('leaves an unknown salt untouched but normalised', () => {
    expect(canonicaliseSaltName('  Nimesulide  ')).toBe('nimesulide')
  })
})

describe('unit normalisation', () => {
  it('converts grams to milligrams', () => {
    expect(normaliseUnit(1, 'g')).toEqual({ value: 1000, unit: 'mg' })
  })
  it('converts gm to milligrams', () => {
    expect(normaliseUnit(2, 'gm')).toEqual({ value: 2000, unit: 'mg' })
  })
  it('leaves mcg as mcg', () => {
    expect(normaliseUnit(25, 'mcg')).toEqual({ value: 25, unit: 'mcg' })
  })
  it('leaves IU as iu', () => {
    expect(normaliseUnit(60000, 'IU')).toEqual({ value: 60000, unit: 'iu' })
  })
  it('never merges mcg into mg', () => {
    expect(normaliseUnit(500, 'mcg').unit).not.toBe(normaliseUnit(500, 'mg').unit)
  })
})

describe('dosage form normalisation', () => {
  it('normalises tab to tablet', () => expect(normaliseForm('Tab')).toBe('tablet'))
  it('normalises caps to capsule', () => expect(normaliseForm('Caps')).toBe('capsule'))
  it('recognises syrup', () => expect(normaliseForm('Syrup')).toBe('syrup'))
  it('recognises dry syrup as suspension', () =>
    expect(normaliseForm('Dry Syrup')).toBe('suspension'))
  it('recognises injection', () => expect(normaliseForm('Injection')).toBe('injection'))
  it('recognises drops', () => expect(normaliseForm('Eye Drop')).toBe('drops'))
  it('recognises inhaler', () => expect(normaliseForm('Rotacaps')).toBe('inhaler'))
  it('treats SR tablets as a separate form', () =>
    expect(normaliseForm('Tablet', 'Glycomet SR 500')).toBe('tablet_er'))
  it('treats XR tablets as a separate form', () =>
    expect(normaliseForm('Tablet XR')).toBe('tablet_er'))
  it('treats ER capsules as a separate form', () =>
    expect(normaliseForm('Capsule', 'Depran ER')).toBe('capsule_er'))
  it('falls back to other for an unknown form', () =>
    expect(normaliseForm('Sachet')).toBe('other'))
})

describe('composition parsing', () => {
  it('parses a single salt', () => {
    const { salts, confidence } = parseComposition('Paracetamol (500mg)')
    expect(salts).toEqual([{ salt: 'paracetamol', strength: 500, unit: 'mg' }])
    expect(confidence).toBe(1)
  })
  it('parses a two-salt combination', () => {
    const { salts } = parseComposition('Paracetamol (500mg) + Caffeine (65mg)')
    expect(salts).toHaveLength(2)
  })
  it('parses a three-salt cold combination', () => {
    const { salts } = parseComposition(
      'Paracetamol (325mg) + Phenylephrine Hydrochloride (5mg) + Chlorpheniramine Maleate (2mg)',
    )
    expect(salts.map((s) => s.salt).sort()).toEqual([
      'chlorpheniramine',
      'paracetamol',
      'phenylephrine',
    ])
  })
  it('parses decimal strengths', () => {
    const { salts } = parseComposition('Amlodipine (2.5mg)')
    expect(salts[0].strength).toBe(2.5)
  })
  it('parses per-ml syrup strengths', () => {
    const { salts } = parseComposition('Paracetamol (250mg)')
    expect(salts[0].unit).toBe('mg')
  })
  it('lowers confidence when a strength is missing', () => {
    const { confidence } = parseComposition('Paracetamol + Caffeine (65mg)')
    expect(confidence).toBeLessThan(0.75)
  })
  it('returns nothing for an empty composition', () => {
    expect(parseComposition('').salts).toHaveLength(0)
  })
  it('penalises herbal extract blends', () => {
    const { confidence } = parseComposition('Ashwagandha Extract (100mg)')
    expect(confidence).toBeLessThan(0.75)
  })
  it('splits on "and"', () => {
    const { salts } = parseComposition('Ibuprofen (400mg) and Paracetamol (325mg)')
    expect(salts).toHaveLength(2)
  })
})

describe('canonical key', () => {
  it('builds a single-salt key', () => {
    expect(key('Paracetamol (500mg)', 'Tablet')).toBe('paracetamol:500mg|tablet')
  })
  it('sorts salts alphabetically so order of writing does not matter', () => {
    expect(key('Paracetamol (500mg) + Caffeine (65mg)', 'Tablet')).toBe(
      'caffeine:65mg|paracetamol:500mg|tablet',
    )
    expect(key('Caffeine (65mg) + Paracetamol (500mg)', 'Tablet')).toBe(
      'caffeine:65mg|paracetamol:500mg|tablet',
    )
  })
  it('matches across brand spellings of the same salt', () => {
    expect(key('Acetaminophen (500mg)', 'Tablet')).toBe(key('Paracetamol 500mg', 'Tablet'))
  })
  it('matches across salt-form suffixes in the synonym table', () => {
    expect(key('Metformin Hydrochloride (500mg)', 'Tablet')).toBe(
      key('Metformin (500mg)', 'Tablet'),
    )
  })
  it('separates different strengths', () => {
    expect(key('Paracetamol (500mg)', 'Tablet')).not.toBe(key('Paracetamol (650mg)', 'Tablet'))
  })
  it('separates tablet from capsule', () => {
    expect(key('Amoxicillin (500mg)', 'Tablet')).not.toBe(key('Amoxicillin (500mg)', 'Capsule'))
  })
  it('separates immediate release from extended release', () => {
    expect(key('Metformin (500mg)', 'Tablet')).not.toBe(
      key('Metformin (500mg)', 'Tablet', 'Glycomet SR 500'),
    )
  })
  it('separates mcg from mg at the same number', () => {
    expect(key('Levothyroxine (100mcg)', 'Tablet')).not.toBe(
      key('Levothyroxine (100mg)', 'Tablet'),
    )
  })
  it('equates 1 g with 1000 mg', () => {
    expect(key('Azithromycin (1g)', 'Tablet')).toBe(key('Azithromycin (1000mg)', 'Tablet'))
  })
  it('keeps IU strengths in IU', () => {
    expect(key('Vitamin D3 (60000IU)', 'Tablet')).toBe('cholecalciferol:60000iu|tablet')
  })
  it('withholds the key when a strength is missing', () => {
    expect(key('Paracetamol + Caffeine', 'Tablet')).toBeNull()
  })
  it('withholds the key when the form is unknown', () => {
    expect(key('Paracetamol (500mg)', 'Sachet')).toBeNull()
  })
  it('withholds the key for a low-confidence blend', () => {
    expect(key('Herbal Extract (100mg)', 'Tablet')).toBeNull()
  })
  it('builds an amoxicillin-clavulanate key', () => {
    expect(key('Amoxycillin (500mg) + Potassium Clavulanate (125mg)', 'Tablet')).toBe(
      'amoxicillin:500mg|clavulanic acid:125mg|tablet',
    )
  })
  it('matches clavulanate written as clavulanic acid', () => {
    expect(key('Amoxicillin (500mg) + Clavulanic Acid (125mg)', 'Tablet')).toBe(
      key('Amoxycillin (500mg) + Potassium Clavulanate (125mg)', 'Tablet'),
    )
  })
  it('handles a syrup composition', () => {
    expect(key('Paracetamol (125mg)', 'Syrup')).toBe('paracetamol:125mg|syrup')
  })
  it('handles an ointment composition', () => {
    expect(key('Povidone-Iodine (5%)', 'Ointment')).toBe('povidone iodine:5%|ointment')
  })
  it('is stable across whitespace and case noise', () => {
    expect(key('  PARACETAMOL   ( 500 MG )  ', 'TABLET')).toBe('paracetamol:500mg|tablet')
  })
})

describe('salt identity key (duplicate detection)', () => {
  it('ignores strength', () => {
    const a = canonicalKey('Paracetamol (500mg)', 'Tablet')
    const b = canonicalKey('Paracetamol (650mg)', 'Tablet')
    expect(saltIdentityKey(a.salts)).toBe(saltIdentityKey(b.salts))
  })
  it('ignores form', () => {
    const a = canonicalKey('Paracetamol (500mg)', 'Tablet')
    const b = canonicalKey('Paracetamol (125mg)', 'Syrup')
    expect(saltIdentityKey(a.salts)).toBe(saltIdentityKey(b.salts))
  })
  it('distinguishes a combination from a single salt', () => {
    const a = canonicalKey('Paracetamol (500mg)', 'Tablet')
    const b = canonicalKey('Paracetamol (500mg) + Caffeine (65mg)', 'Tablet')
    expect(saltIdentityKey(a.salts)).not.toBe(saltIdentityKey(b.salts))
  })
})

describe('matching real-world query shapes', () => {
  const products = [
    {
      id: 'a',
      brand_name: 'Augmentin 625 Duo',
      composition_raw: 'Amoxycillin (500mg) + Potassium Clavulanate (125mg)',
      salts: [
        { salt: 'amoxicillin', strength: 500, unit: 'mg' },
        { salt: 'clavulanic acid', strength: 125, unit: 'mg' },
      ],
      canonical_key: 'amoxicillin:500mg|clavulanic acid:125mg|tablet',
      is_jan_aushadhi: false,
      price_per_unit: 22.1,
      unit_label: 'tablet',
    },
    {
      id: 'b',
      brand_name: 'Glycomet 500',
      composition_raw: 'Metformin Hydrochloride (500mg)',
      salts: [{ salt: 'metformin', strength: 500, unit: 'mg' }],
      canonical_key: 'metformin:500mg|tablet',
      is_jan_aushadhi: false,
      price_per_unit: 2.4,
      unit_label: 'tablet',
    },
    {
      id: 'c',
      brand_name: 'Glycomet SR 500',
      composition_raw: 'Metformin Hydrochloride (500mg)',
      salts: [{ salt: 'metformin', strength: 500, unit: 'mg' }],
      canonical_key: 'metformin:500mg|tablet_er',
      is_jan_aushadhi: false,
      price_per_unit: 3.1,
      unit_label: 'tablet',
    },
    {
      id: 'd',
      brand_name: 'Metformin 500mg Tablet',
      composition_raw: 'Metformin Hydrochloride (500mg)',
      salts: [{ salt: 'metformin', strength: 500, unit: 'mg' }],
      canonical_key: 'metformin:500mg|tablet',
      is_jan_aushadhi: true,
      price_per_unit: 0.6,
      unit_label: 'tablet',
    },
  ] as unknown as Product[]

  it('resolves a strength written twice', () => {
    const r = search(products, 'Glycomet 500 500mg')
    expect(r.best?.product.brand_name).toBe('Glycomet 500')
    expect(r.confident).toBe(true)
  })

  it('does not confuse immediate release with SR', () => {
    const r = search(products, 'Glycomet SR 500')
    expect(r.best?.product.brand_name).toBe('Glycomet SR 500')
  })

  it('resolves a pack photo that includes the whole composition', () => {
    const r = search(products, 'Augmentin 625 Duo 500mg + 125mg')
    expect(r.best?.product.brand_name).toBe('Augmentin 625 Duo')
    expect(r.confident).toBe(true)
  })

  it('prefers the generic when a salt query ties', () => {
    const r = search(products, 'metformin 500')
    expect(r.candidates[0].product.is_jan_aushadhi).toBe(true)
  })
})
