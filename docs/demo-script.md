# Demo script

Five minutes, five prescriptions, one screen each. Every number below was produced by the engine
on the committed seed (`npm run seed` is deterministic, so they will not move under you).
Default location: Hazratganj, Lucknow. Default language: Hindi.

**Before you start:** `npm run dev`, open `http://localhost:3100`, and leave `DEMO_MODE=1` set so
every AI path serves its cached result — no quota, no network, no variance.

---

## 0. Thirty-second framing

> "A strip of Atorva 10 costs ₹136. The same salt, same strength, from the Jan Aushadhi Kendra 200
> metres away, costs ₹11. The medicine is identical. Nobody tells the patient."

Open the home screen. Point at the four equal-weight inputs — **📷 prescription, 📦 strip, 🎤 speak,
⌨️ type** — and say: a person who cannot read a prescription can still use three of those four.

---

## 1. Chronic care — the hero number

**Try a demo prescription → "Monthly diabetes, BP and cholesterol"**

Review screen: three medicines read off the page, each with a green confidence dot, each editable.
Change a name and watch the match update — *"OCR is an aid, not an authority."*

**Find cheaper options:**

| Prescribed | Qty | Now | Same salt | Then | You save | Nearest |
|---|---|---|---|---|---|---|
| Glycomet 500 | 60 tablets | ₹2.37/tab | Metformin 500mg Tablet (Jan Aushadhi) | ₹0.60 | **₹106 (75%)** | Kendra — Hazratganj, 0.18 km |
| Amlopres 5 | 30 tablets | ₹3.69/tab | Amlodipine 5mg Tablet (Jan Aushadhi) | ₹0.45 | **₹97 (88%)** | same |
| Atorva 10 | 30 tablets | ₹8.58/tab | Atorvastatin 10mg Tablet (Jan Aushadhi) | ₹1.10 | **₹224 (87%)** | same |

> **₹510.30 → ₹82.50 — saving ₹427.80 (84%) a month. ₹5,133 a year.**

Things to point at, in order:
1. The savings banner counts up, and the progress bar shows ₹510 → ₹83.
2. **Listen 🔊** — the whole result read aloud in Hindi, from the engine's own numbers.
3. Tap the green **"वही साल्ट ✓"** badge → the trust explainer: same salt, same strength, same
   quality standards, with a link to the Jan Aushadhi programme page. This is the objection that
   actually stops people buying generics, so it gets its own screen.
4. Every card says **"पर्चा ज़रूरी"** (prescription required). All three are Schedule H.
5. **Save to my medicines** on each card → the My medicines tab now shows ₹510 vs ₹83 a month and
   an estimated refill date. It is all on the phone; there is no login anywhere in this app.

## 2. The Rx gate — the part that must not bend

Still on the chronic result, tap **"बुक करने के लिए पर्चा डालें"** (upload prescription to reserve).

- The sheet splits the basket: nothing here is over the counter, so everything waits.
- Tap **Reserve** without attaching anything → the API answers **422 prescription_required**. Show
  it in the network tab if the audience is technical: *the refusal is server-side, not a disabled
  button.*
- Tap **"डेमो पर्चा लगाएँ"** → the validator runs: the medicine is on the page, the date is 9 days
  old (inside the 180-day window for Schedule H), a prescriber is named, legibility 90% → **✓ पर्चा
  स्वीकार**.
- Reserve → a reservation code, and a status timeline that polls every five seconds.

Now open **/pharmacist** in a second window, sign in as *Jan Aushadhi Kendra — Hazratganj*:

- The request is in the queue with the prescription thumbnail, the extracted prescriber fields and
  a legibility score.
- **"Collected"** is disabled. Hover it: *verify the prescription first.*
- **Prescription OK** → now Collected works. The citizen window updates on its next poll.

That sequence is the whole compliance story: software never clears a prescription, it only routes
it to the person whose licence is on the wall.

## 3. Two medicines, one salt — the safety catch

**Try a demo prescription → "Two medicines, same salt"** (Combiflam + Dolo 650 + Pan 40)

A red chip appears on the review screen, *before* any price is shown:

> **इन दवाओं में एक ही साल्ट (paracetamol) है। डॉक्टर या फार्मासिस्ट से पूछें।**
> (Combiflam, Dolo 650)

Say plainly what it is and is not: this compares canonical salt names only. It is not an
interaction checker, and the app does not pretend to be one. Total saving here: **₹110.60 (73%)**.

## 4. Thyroid — when the app argues against itself

**Try a demo prescription → "Thyroid — switching needs a doctor"**

Thyronorm 50 has a cheaper same-salt option (₹1.47 → ₹0.42, saving ₹32), and the card still carries
a red warning:

> **levothyroxine बदलने से पहले डॉक्टर से पूछें** — for this medicine, small differences between
> brands can matter.

Fourteen narrow-therapeutic-index salts are curated in `data/schemes/narrow_therapeutic_index.json`
and never lose that warning. A price-comparison app that cannot say "don't switch this one" should
not be trusted with the other forty-nine. (Shelcal 500 on the same prescription saves ₹216 — the
total is ₹247.20, 86%.)

## 5. Over the counter — grounded information, no advice

**Try a demo prescription → "Allergy and fever"** (Alerid 10 + Crocin Advance 500, saving ₹36.20)

These are OTC, so an **"ℹ️ ख़रीदने से पहले"** button appears. Tap it:

- **किस लिए** / **आम दुष्प्रभाव** / **इन हालात में डॉक्टर के पास जाएँ** — three icon-led sections,
  each with a **Listen 🔊**.
- At the bottom: the source links (openFDA, MedlinePlus) and *"हम खुराक … कभी नहीं बताते"* — we never
  show a dose.
- Switch language in the top bar: Hindi, English and Awadhi are all pre-reviewed and cached, so the
  sheet opens instantly and offline.
- Now tap the same button on a prescription medicine — there isn't one. `/api/medicines/{id}/info`
  returns **403** for anything that is not `OTC`.

## 6. Strip scan, map, offline, schemes — the quick lap

- **📦 Scan strip** → the cached scan reads *Dolo 650 / Paracetamol / 650mg* and goes straight to
  the same comparison. Identification only: an Rx pack still hits the gate.
- **Find on map** → Jan Aushadhi Kendras in saffron, private pharmacies in teal, out-of-stock greyed
  out. Every row shows distance, a licence number, a **Verified** badge where the owner has claimed
  the shop, and a **"स्टॉक की पुष्टि नहीं"** chip. Say the quiet part: *per-pharmacy stock is the one
  thing no public API in India provides — this is demo stock, labelled as demo stock everywhere.*
- **Pharmacist → Confirm stock is current** → reload the map: that shop now reads **"स्टॉक 0 घंटे
  पहले अपडेट"** and climbs the ranking. That is the incentive loop that makes real stock arrive.
- **Turn off Wi-Fi, reload the result** → it renders from IndexedDB with a **"saved on …"** badge,
  and Reserve is withheld because stock may have changed.
- **Schemes** → ask *"my mother needs dialysis every week"* → PM National Dialysis Programme first,
  then the UP state scheme and Jan Aushadhi, each with eligibility, the document checklist, how to
  apply, and a link to the government page it came from. Answers are confined to 17 curated entries
  and must cite them by id.
- **Accessibility menu** → **Large text and high contrast** (20px, AAA tokens, simplified cards) and
  **Voice guidance** (each screen announces itself; results are read in a fixed order). Both persist
  on the device.
- **/impact** → savings surfaced, top searches, a ~1 km search grid, and *"areas with no Jan Aushadhi
  Kendra within 3 km"* — the policy ask, not just a vanity chart.

## 7. Close

> "Three things are deliberate. The substitution engine is arithmetic on an exact salt-strength-form
> key, so it cannot hallucinate a swap. The prescription gate is server-side and fails closed, so it
> cannot be clicked around. And every price is traceable to a published government source. The model
> only ever reads a photo, translates, and reads the answer out loud in Hindi."

---

## If something goes wrong on stage

| Symptom | Fix |
|---|---|
| Savings look different | `npm run seed` then restart dev — the seed is deterministic |
| A demo prescription shows no matches | restart the dev server; the in-memory prescription store resets |
| Map tiles don't load | the markers, list, distances and prices are all still correct — tiles are the only network dependency |
| An AI step is slow | confirm `DEMO_MODE=1`; everything should be served from the cached path |
| Reservation code 404s | reservations are in-memory; a dev-server restart clears them |
