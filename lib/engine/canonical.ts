/**
 * Canonical key parser.
 *
 * A canonical key identifies "the same medicine": the exact same salts at the
 * exact same strengths in the exact same dosage form. Two products may be
 * substituted for each other only if their canonical keys are byte-identical.
 *
 *   caffeine:65mg|paracetamol:500mg|tablet
 *
 * Nothing here is heuristic beyond an explicit synonym table. When parsing is
 * not confident the key is null, and a null key never gets a substitute.
 */

import type { DosageForm, Salt } from './types'

/**
 * Explicit synonym table. Salt-form suffixes (hydrochloride, sodium, ...) are
 * only ever stripped through this table — never by a generic rule, because
 * some suffixes change the molecule.
 */
export const SALT_SYNONYMS: Record<string, string> = {
  acetaminophen: 'paracetamol',
  'paracetamol ip': 'paracetamol',
  amoxycillin: 'amoxicillin',
  'amoxycillin trihydrate': 'amoxicillin',
  'amoxicillin trihydrate': 'amoxicillin',
  'clavulanic acid': 'clavulanic acid',
  'potassium clavulanate': 'clavulanic acid',
  'vitamin d3': 'cholecalciferol',
  'vitamin d': 'cholecalciferol',
  'vitamin b12': 'cyanocobalamin',
  'vitamin c': 'ascorbic acid',
  'metformin hydrochloride': 'metformin',
  'metformin hcl': 'metformin',
  'amlodipine besylate': 'amlodipine',
  'amlodipine besilate': 'amlodipine',
  'atorvastatin calcium': 'atorvastatin',
  'rosuvastatin calcium': 'rosuvastatin',
  'cetirizine hydrochloride': 'cetirizine',
  'cetirizine di hydrochloride': 'cetirizine',
  'cetirizine dihydrochloride': 'cetirizine',
  'levocetirizine dihydrochloride': 'levocetirizine',
  'ranitidine hydrochloride': 'ranitidine',
  'pantoprazole sodium': 'pantoprazole',
  'pantoprazole sodium sesquihydrate': 'pantoprazole',
  'omeprazole magnesium': 'omeprazole',
  'esomeprazole magnesium': 'esomeprazole',
  'rabeprazole sodium': 'rabeprazole',
  'diclofenac sodium': 'diclofenac',
  'diclofenac potassium': 'diclofenac',
  'aceclofenac': 'aceclofenac',
  'ibuprofen': 'ibuprofen',
  'azithromycin dihydrate': 'azithromycin',
  'ciprofloxacin hydrochloride': 'ciprofloxacin',
  'levofloxacin hemihydrate': 'levofloxacin',
  'ofloxacin': 'ofloxacin',
  'cefixime trihydrate': 'cefixime',
  'telmisartan': 'telmisartan',
  'losartan potassium': 'losartan',
  'metoprolol succinate': 'metoprolol succinate',
  'metoprolol tartrate': 'metoprolol tartrate',
  'levothyroxine sodium': 'levothyroxine',
  'thyroxine sodium': 'levothyroxine',
  'warfarin sodium': 'warfarin',
  'phenytoin sodium': 'phenytoin',
  'sodium valproate': 'valproate',
  'valproic acid': 'valproate',
  'lithium carbonate': 'lithium',
  'digoxin': 'digoxin',
  'glimepiride': 'glimepiride',
  'sitagliptin phosphate': 'sitagliptin',
  'salbutamol sulphate': 'salbutamol',
  'salbutamol sulfate': 'salbutamol',
  albuterol: 'salbutamol',
  'montelukast sodium': 'montelukast',
  'ondansetron hydrochloride': 'ondansetron',
  'domperidone maleate': 'domperidone',
  'dicyclomine hydrochloride': 'dicyclomine',
  'tramadol hydrochloride': 'tramadol',
  'alprazolam': 'alprazolam',
  'ferrous sulphate': 'ferrous sulphate',
  'ferrous ascorbate': 'ferrous ascorbate',
  'folic acid': 'folic acid',
  'calcium carbonate': 'calcium carbonate',
  'povidone iodine': 'povidone iodine',
  'povidone-iodine': 'povidone iodine',
  'chlorpheniramine maleate': 'chlorpheniramine',
  'cpm': 'chlorpheniramine',
  'phenylephrine hydrochloride': 'phenylephrine',
  'dextromethorphan hydrobromide': 'dextromethorphan',
  'ambroxol hydrochloride': 'ambroxol',
  'hydroxychloroquine sulphate': 'hydroxychloroquine',
  'prednisolone': 'prednisolone',
  'deflazacort': 'deflazacort',
  'clotrimazole': 'clotrimazole',
  'fluconazole': 'fluconazole',
  'carbamazepine': 'carbamazepine',
  'cyclosporine': 'ciclosporin',
  'cyclosporin': 'ciclosporin',
  'tacrolimus': 'tacrolimus',
}

const FORM_TOKENS: Array<[RegExp, DosageForm]> = [
  [/\b(tablets?|tabs?|dt|caplet)\b/, 'tablet'],
  [/\b(capsules?|caps?)\b/, 'capsule'],
  [/\b(suspensions?|dry syrup|oral suspension)\b/, 'suspension'],
  [/\bsyrups?\b/, 'syrup'],
  [/\b(injections?|inj|vial|ampoule|infusion)\b/, 'injection'],
  [/\bcreams?\b/, 'cream'],
  [/\b(ointments?|gel)\b/, 'ointment'],
  [/\b(drops?|eye drop|ear drop|nasal spray)\b/, 'drops'],
  [/\b(inhalers?|rotacaps?|respules?|mdi)\b/, 'inhaler'],
]

/** Extended / sustained / modified release markers. ER is a different form. */
const ER_TOKENS =
  /\b(sr|xr|er|cr|mr|xl|la|od|retard|extended[- ]release|sustained[- ]release|modified[- ]release|controlled[- ]release)\b/

export function normaliseForm(raw: string | null | undefined, nameHint = ''): DosageForm {
  const text = `${raw ?? ''} ${nameHint}`.toLowerCase()
  let base: DosageForm = 'other'
  for (const [re, form] of FORM_TOKENS) {
    if (re.test(text)) {
      base = form
      break
    }
  }
  if (base === 'other') return 'other'
  if ((base === 'tablet' || base === 'capsule') && ER_TOKENS.test(text)) {
    return base === 'tablet' ? 'tablet_er' : 'capsule_er'
  }
  return base
}

/** Units are normalised but never merged across incompatible families. */
export function normaliseUnit(value: number, unit: string): { value: number; unit: string } {
  const u = unit.toLowerCase().replace(/\s+/g, '')
  if (u === 'g' || u === 'gm' || u === 'gms' || u === 'gram' || u === 'grams') {
    return { value: value * 1000, unit: 'mg' }
  }
  if (u === 'mg' || u === 'mgs') return { value, unit: 'mg' }
  if (u === 'mcg' || u === 'µg' || u === 'ug') return { value, unit: 'mcg' }
  if (u === 'iu' || u === 'i.u' || u === 'i.u.' || u === 'units' || u === 'unit') {
    return { value, unit: 'iu' }
  }
  if (u === 'ml' || u === 'mls') return { value, unit: 'ml' }
  if (u === '%' || u === 'w/v' || u === 'w/w') return { value, unit: '%' }
  return { value, unit: u }
}

function fmtNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(4)))
}

export function canonicaliseSaltName(raw: string): string {
  let name = raw
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\bip\b|\busp\b|\bbp\b|\beq\.? to\b|\bequivalent to\b/g, ' ')
    .replace(/[^a-z0-9\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (SALT_SYNONYMS[name]) return SALT_SYNONYMS[name]
  // A synonym may be a prefix of a longer written form ("metformin hcl ip").
  for (const key of Object.keys(SALT_SYNONYMS)) {
    if (name.startsWith(`${key} `)) return SALT_SYNONYMS[key]
  }
  return name
}

const STRENGTH_RE =
  /(\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|ug|gms|gm|g|ml|iu|i\.u\.?|%)(?![a-z0-9])/i

export interface ParsedComposition {
  salts: Salt[]
  /** 0..1 — below 0.75 the canonical key is withheld. */
  confidence: number
}

/** Splits a raw composition string into (salt, strength, unit) triples. */
export function parseComposition(raw: string): ParsedComposition {
  const text = (raw ?? '').replace(/ /g, ' ').trim()
  if (!text) return { salts: [], confidence: 0 }

  const parts = text
    .split(/\s*(?:\+|,(?!\d)|\band\b|&)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean)

  const salts: Salt[] = []
  let missingStrength = 0

  for (const part of parts) {
    const m = part.match(STRENGTH_RE)
    const nameSource = m ? part.replace(m[0], ' ') : part
    const salt = canonicaliseSaltName(nameSource)
    if (!salt || salt.length < 3) continue
    if (m) {
      const value = parseFloat(m[1].replace(',', '.'))
      const { value: v, unit } = normaliseUnit(value, m[2])
      salts.push({ salt, strength: v, unit })
    } else {
      missingStrength += 1
      salts.push({ salt, strength: null, unit: null })
    }
  }

  if (salts.length === 0) return { salts: [], confidence: 0 }

  let confidence = 1
  if (missingStrength > 0) confidence -= 0.4 * (missingStrength / salts.length) + 0.2
  if (salts.length > 4) confidence -= 0.2
  // Unmapped single-word fragments ("extract", "others") are a parse smell.
  if (salts.some((s) => /\b(extract|others?|etc|excipients?)\b/.test(s.salt))) confidence -= 0.5

  return { salts, confidence: Math.max(0, Math.min(1, confidence)) }
}

export const CONFIDENCE_THRESHOLD = 0.75

/**
 * Builds the canonical key, or returns null when we are not confident enough
 * to claim two products are interchangeable.
 */
export function canonicalKey(
  compositionRaw: string,
  dosageFormRaw?: string | null,
  nameHint = '',
): { key: string | null; salts: Salt[]; form: DosageForm; confidence: number } {
  const { salts, confidence } = parseComposition(compositionRaw)
  const form = normaliseForm(dosageFormRaw ?? compositionRaw, nameHint)

  const usable =
    salts.length > 0 &&
    confidence >= CONFIDENCE_THRESHOLD &&
    salts.every((s) => s.strength !== null && s.unit !== null) &&
    form !== 'other'

  if (!usable) return { key: null, salts, form, confidence }

  const sorted = [...salts].sort((a, b) => a.salt.localeCompare(b.salt))
  const key = `${sorted
    .map((s) => `${s.salt}:${fmtNumber(s.strength as number)}${s.unit}`)
    .join('|')}|${form}`

  return { key, salts: sorted, form, confidence }
}

/** The salt-identity key, ignoring strength and form. Used for duplicate detection. */
export function saltIdentityKey(salts: Salt[]): string {
  return [...salts]
    .map((s) => s.salt)
    .sort((a, b) => a.localeCompare(b))
    .join('+')
}

/** The key used for drug-information lookup: salts only, no strength. */
export function saltInfoKey(salts: Salt[]): string {
  return saltIdentityKey(salts)
}
