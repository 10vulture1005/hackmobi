/**
 * Demo medicine catalogue.
 *
 * Structure mirrors what the real ingestion scripts produce (see
 * /docs/data-sources.md): one entry per canonical medicine, with the branded
 * products that share it and the Jan Aushadhi generic where the programme
 * lists one. Prices are representative of Indian retail MRPs and are DEMO
 * DATA, not a live price feed.
 */

import type { Schedule } from '@/lib/engine/types'

export interface CatalogBrand {
  name: string
  mfr: string
  pack: number
  mrp: number
}

export interface CatalogEntry {
  /** Raw composition string, in the shape Indian datasets publish it. */
  composition: string
  form: string
  schedule: Schedule
  unit_label: string
  /** Narrow therapeutic index — switching needs a doctor. */
  nti?: boolean
  /** NPPA ceiling price per unit, where the salt is in the NLEM. */
  nppa?: number
  /** Jan Aushadhi Kendra generic, where the PMBJP list has one. */
  ja?: { name: string; pack: number; mrp: number }
  brands: CatalogBrand[]
}

export const CATALOG: CatalogEntry[] = [
  {
    composition: 'Paracetamol (500mg)',
    form: 'Tablet',
    schedule: 'OTC',
    unit_label: 'tablet',
    nppa: 2.16,
    ja: { name: 'Paracetamol 500mg Tablet', pack: 10, mrp: 8.5 },
    brands: [
      { name: 'Crocin Advance 500', mfr: 'GlaxoSmithKline', pack: 15, mrp: 30 },
      { name: 'Calpol 500', mfr: 'GlaxoSmithKline', pack: 15, mrp: 28.5 },
      { name: 'Pacimol 500', mfr: 'Ipca Laboratories', pack: 10, mrp: 15 },
    ],
  },
  {
    composition: 'Paracetamol (650mg)',
    form: 'Tablet',
    schedule: 'OTC',
    unit_label: 'tablet',
    nppa: 2.48,
    ja: { name: 'Paracetamol 650mg Tablet', pack: 10, mrp: 11 },
    brands: [
      { name: 'Dolo 650', mfr: 'Micro Labs', pack: 15, mrp: 34.5 },
      { name: 'Calpol 650', mfr: 'GlaxoSmithKline', pack: 15, mrp: 33 },
      { name: 'Pyrigesic 650', mfr: 'East India Pharmaceutical', pack: 10, mrp: 21 },
      // Deliberately priced above the NLEM ceiling, to demonstrate the NPPA
      // overpricing flag. Fictional brand and manufacturer.
      { name: 'Fevago 650', mfr: 'Demo Pharma Pvt Ltd', pack: 10, mrp: 45 },
    ],
  },
  {
    composition: 'Paracetamol (500mg) + Caffeine (65mg)',
    form: 'Tablet',
    schedule: 'OTC',
    unit_label: 'tablet',
    brands: [
      { name: 'Crocin Pain Relief', mfr: 'GlaxoSmithKline', pack: 15, mrp: 48 },
      { name: 'Cofnil Plus', mfr: 'Alkem Laboratories', pack: 10, mrp: 29 },
    ],
  },
  {
    composition: 'Paracetamol (325mg) + Ibuprofen (400mg)',
    form: 'Tablet',
    schedule: 'OTC',
    unit_label: 'tablet',
    ja: { name: 'Ibuprofen 400mg + Paracetamol 325mg Tablet', pack: 10, mrp: 13 },
    brands: [
      { name: 'Combiflam', mfr: 'Sanofi India', pack: 20, mrp: 56 },
      { name: 'Ibugesic Plus', mfr: 'Cipla', pack: 15, mrp: 38 },
      { name: 'Flexon', mfr: 'Aristo Pharmaceuticals', pack: 20, mrp: 49 },
    ],
  },
  {
    composition: 'Ibuprofen (400mg)',
    form: 'Tablet',
    schedule: 'OTC',
    unit_label: 'tablet',
    nppa: 3.02,
    ja: { name: 'Ibuprofen 400mg Tablet', pack: 10, mrp: 7.5 },
    brands: [
      { name: 'Brufen 400', mfr: 'Abbott India', pack: 15, mrp: 42 },
      { name: 'Ibugesic 400', mfr: 'Cipla', pack: 10, mrp: 22 },
    ],
  },
  {
    composition: 'Paracetamol (125mg)',
    form: 'Syrup',
    schedule: 'OTC',
    unit_label: 'ml',
    ja: { name: 'Paracetamol 125mg/5ml Syrup', pack: 60, mrp: 15 },
    brands: [
      { name: 'Calpol 120 Suspension', mfr: 'GlaxoSmithKline', pack: 60, mrp: 42 },
      { name: 'Crocin Syrup', mfr: 'GlaxoSmithKline', pack: 60, mrp: 39 },
    ],
  },
  {
    composition: 'Cetirizine Hydrochloride (10mg)',
    form: 'Tablet',
    schedule: 'OTC',
    unit_label: 'tablet',
    nppa: 3.46,
    ja: { name: 'Cetirizine 10mg Tablet', pack: 10, mrp: 5 },
    brands: [
      { name: 'Alerid 10', mfr: 'Cipla', pack: 10, mrp: 32 },
      { name: 'Cetzine 10', mfr: 'GlaxoSmithKline', pack: 10, mrp: 29 },
      { name: 'Okacet 10', mfr: 'Cipla', pack: 10, mrp: 24 },
    ],
  },
  {
    composition: 'Levocetirizine Dihydrochloride (5mg)',
    form: 'Tablet',
    schedule: 'OTC',
    unit_label: 'tablet',
    ja: { name: 'Levocetirizine 5mg Tablet', pack: 10, mrp: 6.5 },
    brands: [
      { name: 'Levocet 5', mfr: 'Dr Reddys Laboratories', pack: 10, mrp: 44 },
      { name: 'Teczine 5', mfr: 'Ajanta Pharma', pack: 10, mrp: 48 },
    ],
  },
  {
    composition: 'Dextromethorphan Hydrobromide (10mg) + Chlorpheniramine Maleate (2mg)',
    form: 'Syrup',
    schedule: 'OTC',
    unit_label: 'ml',
    brands: [
      { name: 'Ascoril D Plus Syrup', mfr: 'Glenmark Pharmaceuticals', pack: 100, mrp: 128 },
      { name: 'Tossex Syrup', mfr: 'Alkem Laboratories', pack: 100, mrp: 96 },
    ],
  },
  {
    composition: 'Amoxycillin (500mg) + Potassium Clavulanate (125mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    nppa: 23.87,
    ja: { name: 'Amoxicillin 500mg + Clavulanic Acid 125mg Tablet', pack: 10, mrp: 78 },
    brands: [
      { name: 'Augmentin 625 Duo', mfr: 'GlaxoSmithKline', pack: 10, mrp: 221 },
      { name: 'Clavam 625', mfr: 'Alkem Laboratories', pack: 10, mrp: 196 },
      { name: 'Moxikind-CV 625', mfr: 'Mankind Pharma', pack: 10, mrp: 174 },
    ],
  },
  {
    composition: 'Amoxycillin (500mg)',
    form: 'Capsule',
    schedule: 'H',
    unit_label: 'capsule',
    nppa: 8.42,
    ja: { name: 'Amoxicillin 500mg Capsule', pack: 10, mrp: 32 },
    brands: [
      { name: 'Mox 500', mfr: 'Sun Pharmaceutical', pack: 10, mrp: 78 },
      { name: 'Novamox 500', mfr: 'Cipla', pack: 10, mrp: 72 },
    ],
  },
  {
    composition: 'Azithromycin Dihydrate (500mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    nppa: 33.12,
    ja: { name: 'Azithromycin 500mg Tablet', pack: 3, mrp: 36 },
    brands: [
      { name: 'Azithral 500', mfr: 'Alembic Pharmaceuticals', pack: 5, mrp: 124 },
      { name: 'Zithrox 500', mfr: 'FDC Limited', pack: 3, mrp: 86 },
      { name: 'Azee 500', mfr: 'Cipla', pack: 3, mrp: 92 },
    ],
  },
  {
    composition: 'Cefixime Trihydrate (200mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    brands: [
      { name: 'Taxim-O 200', mfr: 'Alkem Laboratories', pack: 10, mrp: 182 },
      { name: 'Zifi 200', mfr: 'FDC Limited', pack: 10, mrp: 168 },
    ],
    ja: { name: 'Cefixime 200mg Tablet', pack: 10, mrp: 66 },
  },
  {
    composition: 'Metformin Hydrochloride (500mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    nppa: 2.92,
    ja: { name: 'Metformin 500mg Tablet', pack: 10, mrp: 6 },
    brands: [
      { name: 'Glycomet 500', mfr: 'USV Private Limited', pack: 20, mrp: 48 },
      { name: 'Glucophage 500', mfr: 'USV Private Limited', pack: 20, mrp: 54 },
      { name: 'Walaphage 500', mfr: 'Wallace Pharmaceuticals', pack: 15, mrp: 39 },
    ],
  },
  {
    composition: 'Metformin Hydrochloride (500mg)',
    form: 'Tablet SR',
    schedule: 'H',
    unit_label: 'tablet',
    ja: { name: 'Metformin 500mg SR Tablet', pack: 10, mrp: 8 },
    brands: [
      { name: 'Glycomet SR 500', mfr: 'USV Private Limited', pack: 20, mrp: 62 },
      { name: 'Carbophage SR 500', mfr: 'Mankind Pharma', pack: 15, mrp: 44 },
    ],
  },
  {
    composition: 'Glimepiride (2mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    ja: { name: 'Glimepiride 2mg Tablet', pack: 10, mrp: 9 },
    brands: [
      { name: 'Amaryl 2', mfr: 'Sanofi India', pack: 10, mrp: 118 },
      { name: 'Glimestar 2', mfr: 'Mankind Pharma', pack: 10, mrp: 72 },
    ],
  },
  {
    composition: 'Sitagliptin Phosphate (100mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    brands: [
      { name: 'Januvia 100', mfr: 'MSD Pharmaceuticals', pack: 7, mrp: 196 },
      { name: 'Istavel 100', mfr: 'Sun Pharmaceutical', pack: 15, mrp: 268 },
    ],
    ja: { name: 'Sitagliptin 100mg Tablet', pack: 10, mrp: 95 },
  },
  {
    composition: 'Amlodipine Besylate (5mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    nppa: 4.46,
    ja: { name: 'Amlodipine 5mg Tablet', pack: 10, mrp: 4.5 },
    brands: [
      { name: 'Amlopres 5', mfr: 'Cipla', pack: 15, mrp: 58 },
      { name: 'Stamlo 5', mfr: 'Dr Reddys Laboratories', pack: 15, mrp: 62 },
      { name: 'Amlokind 5', mfr: 'Mankind Pharma', pack: 10, mrp: 26 },
    ],
  },
  {
    composition: 'Telmisartan (40mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    nppa: 11.23,
    ja: { name: 'Telmisartan 40mg Tablet', pack: 10, mrp: 18 },
    brands: [
      { name: 'Telma 40', mfr: 'Glenmark Pharmaceuticals', pack: 15, mrp: 148 },
      { name: 'Telsartan 40', mfr: 'Dr Reddys Laboratories', pack: 10, mrp: 104 },
    ],
  },
  {
    composition: 'Losartan Potassium (50mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    ja: { name: 'Losartan 50mg Tablet', pack: 10, mrp: 12 },
    brands: [
      { name: 'Losar 50', mfr: 'Unichem Laboratories', pack: 15, mrp: 92 },
      { name: 'Repace 50', mfr: 'Sun Pharmaceutical', pack: 10, mrp: 68 },
    ],
  },
  {
    composition: 'Atorvastatin Calcium (10mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    nppa: 10.58,
    ja: { name: 'Atorvastatin 10mg Tablet', pack: 10, mrp: 11 },
    brands: [
      { name: 'Atorva 10', mfr: 'Zydus Cadila', pack: 15, mrp: 136 },
      { name: 'Storvas 10', mfr: 'Ranbaxy', pack: 10, mrp: 98 },
      { name: 'Lipikind 10', mfr: 'Mankind Pharma', pack: 10, mrp: 74 },
    ],
  },
  {
    composition: 'Rosuvastatin Calcium (10mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    ja: { name: 'Rosuvastatin 10mg Tablet', pack: 10, mrp: 22 },
    brands: [
      { name: 'Rosuvas 10', mfr: 'Sun Pharmaceutical', pack: 10, mrp: 158 },
      { name: 'Rozavel 10', mfr: 'Sun Pharmaceutical', pack: 10, mrp: 142 },
    ],
  },
  {
    composition: 'Pantoprazole Sodium (40mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    nppa: 12.38,
    ja: { name: 'Pantoprazole 40mg Tablet', pack: 10, mrp: 16 },
    brands: [
      { name: 'Pan 40', mfr: 'Alkem Laboratories', pack: 15, mrp: 172 },
      { name: 'Pantocid 40', mfr: 'Sun Pharmaceutical', pack: 15, mrp: 165 },
      { name: 'Pantop 40', mfr: 'Aristo Pharmaceuticals', pack: 10, mrp: 98 },
    ],
  },
  {
    composition: 'Omeprazole (20mg)',
    form: 'Capsule',
    schedule: 'H',
    unit_label: 'capsule',
    ja: { name: 'Omeprazole 20mg Capsule', pack: 10, mrp: 9 },
    brands: [
      { name: 'Omez 20', mfr: 'Dr Reddys Laboratories', pack: 20, mrp: 112 },
      { name: 'Ocid 20', mfr: 'Zydus Cadila', pack: 15, mrp: 86 },
    ],
  },
  {
    composition: 'Domperidone (10mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    brands: [
      { name: 'Domstal 10', mfr: 'Torrent Pharmaceuticals', pack: 10, mrp: 42 },
      { name: 'Vomistop 10', mfr: 'Cipla', pack: 10, mrp: 38 },
    ],
    ja: { name: 'Domperidone 10mg Tablet', pack: 10, mrp: 7 },
  },
  {
    composition: 'Ondansetron Hydrochloride (4mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    ja: { name: 'Ondansetron 4mg Tablet', pack: 10, mrp: 9.5 },
    brands: [
      { name: 'Emeset 4', mfr: 'Cipla', pack: 10, mrp: 48 },
      { name: 'Vomikind 4', mfr: 'Mankind Pharma', pack: 10, mrp: 36 },
    ],
  },
  {
    composition: 'Diclofenac Sodium (50mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    nppa: 4.75,
    ja: { name: 'Diclofenac 50mg Tablet', pack: 10, mrp: 6.5 },
    brands: [
      { name: 'Voveran 50', mfr: 'Novartis India', pack: 10, mrp: 44 },
      { name: 'Dynapar 50', mfr: 'Troikaa Pharmaceuticals', pack: 10, mrp: 38 },
    ],
  },
  {
    composition: 'Aceclofenac (100mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    ja: { name: 'Aceclofenac 100mg Tablet', pack: 10, mrp: 13 },
    brands: [
      { name: 'Hifenac 100', mfr: 'Intas Pharmaceuticals', pack: 10, mrp: 96 },
      { name: 'Zerodol 100', mfr: 'Ipca Laboratories', pack: 10, mrp: 88 },
    ],
  },
  {
    composition: 'Montelukast Sodium (10mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    ja: { name: 'Montelukast 10mg Tablet', pack: 10, mrp: 24 },
    brands: [
      { name: 'Montair 10', mfr: 'Cipla', pack: 15, mrp: 282 },
      { name: 'Montek 10', mfr: 'Sun Pharmaceutical', pack: 15, mrp: 264 },
    ],
  },
  {
    composition: 'Salbutamol Sulphate (100mcg)',
    form: 'Inhaler',
    schedule: 'H',
    unit_label: 'dose',
    brands: [
      { name: 'Asthalin HFA Inhaler', mfr: 'Cipla', pack: 200, mrp: 148 },
      { name: 'Ventorlin Inhaler', mfr: 'GlaxoSmithKline', pack: 200, mrp: 162 },
    ],
    ja: { name: 'Salbutamol 100mcg Inhaler', pack: 200, mrp: 72 },
  },
  {
    composition: 'Levothyroxine Sodium (50mcg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    nti: true,
    ja: { name: 'Thyroxine Sodium 50mcg Tablet', pack: 100, mrp: 42 },
    brands: [
      { name: 'Thyronorm 50', mfr: 'Abbott India', pack: 100, mrp: 158 },
      { name: 'Eltroxin 50', mfr: 'GlaxoSmithKline', pack: 100, mrp: 148 },
    ],
  },
  {
    composition: 'Warfarin Sodium (5mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    nti: true,
    brands: [
      { name: 'Warf 5', mfr: 'Cipla', pack: 30, mrp: 98 },
      { name: 'Uniwarfin 5', mfr: 'Unichem Laboratories', pack: 30, mrp: 86 },
    ],
    ja: { name: 'Warfarin 5mg Tablet', pack: 30, mrp: 48 },
  },
  {
    composition: 'Phenytoin Sodium (100mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    nti: true,
    brands: [
      { name: 'Eptoin 100', mfr: 'Abbott India', pack: 30, mrp: 72 },
      { name: 'Dilantin 100', mfr: 'Pfizer India', pack: 30, mrp: 88 },
    ],
  },
  {
    composition: 'Carbamazepine (200mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    nti: true,
    brands: [
      { name: 'Tegretol 200', mfr: 'Novartis India', pack: 10, mrp: 64 },
      { name: 'Mazetol 200', mfr: 'Sun Pharmaceutical', pack: 10, mrp: 52 },
    ],
    ja: { name: 'Carbamazepine 200mg Tablet', pack: 10, mrp: 26 },
  },
  {
    composition: 'Lithium Carbonate (300mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    nti: true,
    brands: [{ name: 'Lithosun 300', mfr: 'Sun Pharmaceutical', pack: 10, mrp: 58 }],
  },
  {
    composition: 'Alprazolam (0.5mg)',
    form: 'Tablet',
    schedule: 'H1',
    unit_label: 'tablet',
    brands: [
      { name: 'Alprax 0.5', mfr: 'Torrent Pharmaceuticals', pack: 15, mrp: 48 },
      { name: 'Trika 0.5', mfr: 'Torrent Pharmaceuticals', pack: 15, mrp: 52 },
    ],
  },
  {
    composition: 'Tramadol Hydrochloride (50mg)',
    form: 'Capsule',
    schedule: 'H1',
    unit_label: 'capsule',
    brands: [
      { name: 'Tramacip 50', mfr: 'Cipla', pack: 10, mrp: 72 },
      { name: 'Tramazac 50', mfr: 'Zydus Cadila', pack: 10, mrp: 64 },
    ],
  },
  {
    composition: 'Ferrous Ascorbate (100mg) + Folic Acid (1.5mg)',
    form: 'Tablet',
    schedule: 'OTC',
    unit_label: 'tablet',
    ja: { name: 'Ferrous Ascorbate 100mg + Folic Acid 1.5mg Tablet', pack: 10, mrp: 18 },
    brands: [
      { name: 'Orofer XT', mfr: 'Emcure Pharmaceuticals', pack: 10, mrp: 148 },
      { name: 'Feronia XT', mfr: 'Zuventus Healthcare', pack: 10, mrp: 96 },
    ],
  },
  {
    composition: 'Calcium Carbonate (500mg) + Vitamin D3 (250IU)',
    form: 'Tablet',
    schedule: 'OTC',
    unit_label: 'tablet',
    ja: { name: 'Calcium Carbonate 500mg + Vitamin D3 250IU Tablet', pack: 10, mrp: 9 },
    brands: [
      { name: 'Shelcal 500', mfr: 'Torrent Pharmaceuticals', pack: 15, mrp: 128 },
      { name: 'Calcimax 500', mfr: 'Meyer Organics', pack: 15, mrp: 112 },
    ],
  },
  {
    composition: 'Vitamin D3 (60000IU)',
    form: 'Capsule',
    schedule: 'OTC',
    unit_label: 'capsule',
    ja: { name: 'Cholecalciferol 60000IU Capsule', pack: 4, mrp: 22 },
    brands: [
      { name: 'Uprise D3 60K', mfr: 'Alkem Laboratories', pack: 4, mrp: 84 },
      { name: 'D-Rise 60K', mfr: 'USV Private Limited', pack: 4, mrp: 78 },
    ],
  },
  {
    composition: 'Povidone-Iodine (5%)',
    form: 'Ointment',
    schedule: 'OTC',
    unit_label: 'g',
    ja: { name: 'Povidone Iodine 5% Ointment', pack: 15, mrp: 18 },
    brands: [
      { name: 'Betadine Ointment', mfr: 'Win-Medicare', pack: 15, mrp: 74 },
      { name: 'Cipladine Ointment', mfr: 'Cipla', pack: 15, mrp: 48 },
    ],
  },
  {
    composition: 'Clotrimazole (1%)',
    form: 'Cream',
    schedule: 'OTC',
    unit_label: 'g',
    ja: { name: 'Clotrimazole 1% Cream', pack: 15, mrp: 16 },
    brands: [
      { name: 'Candid Cream', mfr: 'Glenmark Pharmaceuticals', pack: 15, mrp: 72 },
      { name: 'Clop-G Cream', mfr: 'Dr Reddys Laboratories', pack: 15, mrp: 58 },
    ],
  },
  {
    composition: 'Fluconazole (150mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    ja: { name: 'Fluconazole 150mg Tablet', pack: 1, mrp: 8 },
    brands: [
      { name: 'Forcan 150', mfr: 'Cipla', pack: 1, mrp: 36 },
      { name: 'Zocon 150', mfr: 'FDC Limited', pack: 1, mrp: 32 },
    ],
  },
  {
    composition: 'Prednisolone (10mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    ja: { name: 'Prednisolone 10mg Tablet', pack: 10, mrp: 7 },
    brands: [
      { name: 'Omnacortil 10', mfr: 'Macleods Pharmaceuticals', pack: 10, mrp: 38 },
      { name: 'Wysolone 10', mfr: 'Wyeth Limited', pack: 10, mrp: 44 },
    ],
  },
  {
    composition: 'Hydroxychloroquine Sulphate (200mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    brands: [
      { name: 'HCQS 200', mfr: 'Ipca Laboratories', pack: 15, mrp: 148 },
      { name: 'Zy-Q 200', mfr: 'Zydus Cadila', pack: 10, mrp: 92 },
    ],
    ja: { name: 'Hydroxychloroquine 200mg Tablet', pack: 10, mrp: 48 },
  },
  {
    composition: 'Ambroxol Hydrochloride (30mg)',
    form: 'Syrup',
    schedule: 'OTC',
    unit_label: 'ml',
    brands: [
      { name: 'Mucolite Syrup', mfr: 'Dr Reddys Laboratories', pack: 100, mrp: 112 },
      { name: 'Ambrodil Syrup', mfr: 'Aristo Pharmaceuticals', pack: 100, mrp: 86 },
    ],
  },
  {
    composition: 'Ciprofloxacin Hydrochloride (500mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    nppa: 11.23,
    ja: { name: 'Ciprofloxacin 500mg Tablet', pack: 10, mrp: 24 },
    brands: [
      { name: 'Ciplox 500', mfr: 'Cipla', pack: 10, mrp: 98 },
      { name: 'Cifran 500', mfr: 'Ranbaxy', pack: 10, mrp: 104 },
    ],
  },
  {
    composition: 'Levofloxacin Hemihydrate (500mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    ja: { name: 'Levofloxacin 500mg Tablet', pack: 10, mrp: 42 },
    brands: [
      { name: 'Levoflox 500', mfr: 'Cipla', pack: 5, mrp: 112 },
      { name: 'Loxof 500', mfr: 'FDC Limited', pack: 10, mrp: 186 },
    ],
  },
  {
    composition: 'Dicyclomine Hydrochloride (20mg)',
    form: 'Tablet',
    schedule: 'H',
    unit_label: 'tablet',
    brands: [
      { name: 'Cyclopam', mfr: 'Indoco Remedies', pack: 10, mrp: 42 },
      { name: 'Spasmonil', mfr: 'Abbott India', pack: 10, mrp: 38 },
    ],
  },
]
