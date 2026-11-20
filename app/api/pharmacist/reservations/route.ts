import { db } from '@/lib/data/db'
import { ensureDemoPrescriptions, getPrescription, listReservations, seedDemoReservations } from '@/lib/server/store'
import { fail, ok } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const pharmacyId = new URL(req.url).searchParams.get('pharmacy_id')
  if (!pharmacyId) return fail(400, 'missing_pharmacy', 'pharmacy_id is required.')
  if (!db().pharmacyById.get(pharmacyId)) return fail(404, 'unknown_pharmacy', 'No such pharmacy.')

  ensureDemoPrescriptions()
  seedDemoReservations(pharmacyId)

  const rows = listReservations(pharmacyId).map((r) => {
    const rx = r.prescription_id ? getPrescription(r.prescription_id) : undefined
    return {
      ...r,
      // A pharmacist sees the prescription only for their own reservations.
      prescription: rx
        ? {
            id: rx.id,
            image_url: rx.image_url,
            validation_status: rx.validation_status,
            doctor_name: rx.extracted.doctor_name,
            registration_no: rx.extracted.registration_no,
            clinic_or_hospital: rx.extracted.clinic_or_hospital,
            prescription_date: rx.extracted.prescription_date,
            legibility_score: rx.extracted.legibility_score,
            items: rx.extracted.items.map((i) => i.raw_text),
          }
        : null,
    }
  })

  return ok({ reservations: rows })
}
