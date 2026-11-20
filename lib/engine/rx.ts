/**
 * Rx gate. Deterministic, server-side, fail-closed.
 *
 * The LLM is never consulted about whether a medicine needs a prescription.
 * The answer comes from products.schedule, which is itself derived from the
 * curated schedule lists in /data/schemes/rx_schedule.json. Anything we cannot
 * classify is treated as prescription-only.
 */

import rxSchedule from '@/data/schemes/rx_schedule.json'
import ntiList from '@/data/schemes/narrow_therapeutic_index.json'
import type { Salt, Schedule } from './types'

const SET = {
  X: new Set(rxSchedule.X.map((s) => s.toLowerCase())),
  H1: new Set(rxSchedule.H1.map((s) => s.toLowerCase())),
  H: new Set(rxSchedule.H.map((s) => s.toLowerCase())),
  OTC: new Set(rxSchedule.OTC.map((s) => s.toLowerCase())),
}

const NTI = new Set(ntiList.salts.map((s) => s.toLowerCase()))

/** Strictness order — used so a cross-check can only ever tighten the gate. */
const STRICTNESS: Record<Schedule, number> = { X: 4, H1: 3, H: 2, unknown: 2, OTC: 1 }

export function stricter(a: Schedule, b: Schedule): Schedule {
  return STRICTNESS[a] >= STRICTNESS[b] ? a : b
}

/**
 * Derives the schedule from the salts alone. Returns 'H' when at least one
 * salt is unclassified, because failing open would help someone skip a
 * prescription.
 */
export function scheduleFromSalts(salts: Salt[]): Schedule {
  if (salts.length === 0) return 'H'
  const names = salts.map((s) => s.salt.toLowerCase())
  if (names.some((n) => SET.X.has(n))) return 'X'
  if (names.some((n) => SET.H1.has(n))) return 'H1'
  if (names.some((n) => SET.H.has(n))) return 'H'
  if (names.every((n) => SET.OTC.has(n))) return 'OTC'
  return 'H'
}

/** Combines a declared schedule from the dataset with our own derivation. */
export function resolveSchedule(salts: Salt[], declared?: Schedule | null): Schedule {
  const derived = scheduleFromSalts(salts)
  if (!declared || declared === 'unknown') return derived
  return stricter(declared, derived)
}

export function isRx(schedule: Schedule): boolean {
  return schedule !== 'OTC'
}

/** Schedule H1 and X: the pharmacist must verify and record the sale at the counter. */
export function requiresCounterVerification(schedule: Schedule): boolean {
  return schedule === 'H1' || schedule === 'X'
}

/** H1 and X are never eligible for home delivery (see /docs/architecture.md). */
export function deliveryBlocked(schedule: Schedule): boolean {
  return requiresCounterVerification(schedule)
}

export function hasNarrowTherapeuticIndex(salts: Salt[]): boolean {
  return salts.some((s) => NTI.has(s.salt.toLowerCase()))
}

/** Prescription validity window in days. H1 is deliberately much shorter. */
export function prescriptionValidityDays(schedule: Schedule): number {
  return requiresCounterVerification(schedule) ? 30 : 180
}
