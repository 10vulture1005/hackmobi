'use client'

import type { ParsePrescriptionResponse } from './api'

/**
 * Short-lived handoff between the upload and review screens. sessionStorage, so
 * a reload keeps the user's place but nothing persists beyond the tab.
 */
const KEY = 'sd:parse:'

export function saveParse(res: ParsePrescriptionResponse) {
  try {
    sessionStorage.setItem(KEY + res.prescription_id, JSON.stringify(res))
    sessionStorage.setItem('sd:parse:last', res.prescription_id)
  } catch {
    /* private mode: the review screen will re-fetch a demo, or ask for a retake */
  }
}

export function getParse(id: string): ParsePrescriptionResponse | null {
  try {
    const raw = sessionStorage.getItem(KEY + id)
    return raw ? (JSON.parse(raw) as ParsePrescriptionResponse) : null
  } catch {
    return null
  }
}

export function lastParseId(): string | null {
  try {
    return sessionStorage.getItem('sd:parse:last')
  } catch {
    return null
  }
}

/** The prescription id attached to the current basket, for the Rx gate. */
export function setBasketPrescription(id: string | null) {
  try {
    if (id) sessionStorage.setItem('sd:basket:rx', id)
    else sessionStorage.removeItem('sd:basket:rx')
  } catch {
    /* ignore */
  }
}

export function basketPrescription(): string | null {
  try {
    return sessionStorage.getItem('sd:basket:rx')
  } catch {
    return null
  }
}
