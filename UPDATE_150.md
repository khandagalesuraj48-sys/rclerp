# update-150 – QR labels: by owner, or the machinery ticked (one or many); 8 on an A4 page (24-10-2026)

**Asked (24-10-2026):** "ajun apn asset sathi qr banwat aahot tr qr mi owner wise machine wise sigle or bulk mdhe print kru shako a4
page war multiple jastit jast 6 to 8 qr yeyla hawet". His answer (24-10-2026): **8 on a page (2 × 4)**.

## What was there
* Asset Master → Machinery list → **QR labels** (03-10-2026): all active machinery, or one typed in "Which machinery"; **12 labels on
  an A4 page** (3 × 4, the code 42 mm). No choice by owner, no choice of several.

## What changes
* **QR labels** asks which labels, in one box:
  * **Owner** – "All owners (n machinery)" or one owner with how many machinery it has; choosing an owner **ticks all its machinery**
    (owner-wise, in bulk);
  * **Find** – number, name, type or owner (any case);
  * the **list of the machinery, each with a tick** (its number, name · type, owner) – **Tick all shown** / **Untick all shown**;
    tick one (single) or as many as wanted, of any owners (machine-wise, in bulk);
  * "**9 ticked – 2 pages**"; nothing ticked: "Nothing ticked" and **Make the labels** cannot be pressed.
  * A machinery open in the Asset Master form: only it is ticked at first (as before: its own label).
* **8 labels on an A4 page (2 × 4, portrait)**: the QR code **bigger (50 mm)** on the left; on its right the customer, the
  **machinery number**, name · type; "Scan: diesel issue · Log Book entry" under them. A new page after every 8. What the code holds
  is unchanged (the app's link with the machinery number) – labels printed before keep working.
* The print's title says what was made: "QR labels – MH-25-AJ-8511", "QR labels – <owner> – 9 machinery", "QR labels – 3 machinery".
* **Phone app:** App 3.31.8 (`rcl-mobile`) – Asset Master ⋮ → QR labels: the same choice (owner, find, ticks, count) and exactly the
  same sheet (its test compares it with the sheet this page makes).
* **Help (English / मराठी / हिंदी):** the Asset Master guide says it; the Marathi / Hindi words of the new texts (`app/i18n`; the
  app's too). The two texts no longer used ("Which machinery", "12 labels on an A4 page …") are taken out of the word files.
* **Page only** (`qrLabels`, `qrLabelsHtml`, `qrSub`, `QR_PER_PAGE` in `app/App.html`; styles `.qr-ask`, `.qr-bar`, `.qr-pick`,
  `.qr-row`). No server change, no database step, no setting, no access change.

## Evidence (local test rig – never live)
* `node --test test/unit.test.js` – 105 / 105 (the guide in 3 languages, the words keep every {n}, the page's script blocks parse).
* `test/browser/qr150.js` (new, browser) – 12 / 12: the owners with their counts, all ticked at first;
  one owner → its 9 machinery ticked, "9 ticked – 2 pages"; the real print window: 8 labels on the first page and 1 on the second,
  each with its QR code, and as a PDF **2 A4 pages**, nothing cut inside a label; Untick all shown → "Nothing ticked", the button
  off; Find + one tick → 1 label, 1 page; 3 machinery of two owners → their 3 labels only; a phone-size screen does not get
  wider; no script error.
* `test/browser/new3.js` (the QR label check of 03-10-2026, changed to tick the machinery): its QR check passes; on main and on
  this branch from the same snapshot its other checks are the same (the "faults of the app" checks: 1–2 fail on both, on and off).

## Not verified
* The live site; printing on a real printer / sticker paper (checked as a PDF of A4 pages); a real phone.

## Going back
* Vercel → Instant Rollback to the deployment before this update (page only; nothing in the data).
