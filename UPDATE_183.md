# update-183 – the old log book as it is; the AI read in parts; Log book status; Hide log book (28-10-2026)

**Asked (28-10-2026, 20:10, with 3 screenshots):** "bhai tu auto gst ka add krt aahet kuthe 6 kuth 2.5 tr kuthe 14 as yar as nko karu n
yar ani je mi old krtoy import tyat tr ajibat karu nko as it is rahude … tu fkt ai ni spelling duplicates asle kru de baki jast old import
nko as it is zale tri chale mala fkt headings ekde tikde astil tr te prooper tyan ghyawet kadhi kadhi ai service slow asa pn error ywto te
pn fix krun de ani ha mala samjay la haw konte vichle / asset ch maintanace log book add aahe kadhi prynt updeted aahe konte ch baki aahe"
and (20:11) "show dable ki distey but prt hide pn krta yaw n re". With the phone app **3.59.0** (the same, as the app's own screens).

**No database step.** No table, no row is changed by the update itself. No secret in any file.

## What changes
* **The old log book's import keeps each line's GST as it is in the file.** No GST % is made from it any more (no "CGST 6 % / 9 % /
  14 %" from a GST ₹): the line is saved with its **GST ₹** (`gstAmt`) exactly as read. The AI only puts the headings in their place,
  fixes spellings and the same name written twice – nothing else is changed.
* **The Maintenance Log Book:** a bill of the old log book shows **"GST Amount"** – no CGST / SGST % columns for it. A new bill (typed in
  the form with its GST %) is shown as before.
* **A line's Edit** of such a bill: "GST ₹ (as in the old log book)" – the ₹ is kept (changed only by typing it). In the whole bill's
  form each such line keeps its GST ₹; typing a GST % on a line makes it a normal line again (its GST from the %).
* **"AI service slow"** fixed: a PDF page is read **in parts** (at most 25 rows at a time, the next part from the last row given), and a
  part that times out or finds the AI busy is **asked again by itself** (up to 4 times, the quicker model too). Still busy: it stops at
  that page – what was read stays – and **"Continue reading (from page N)"** goes on from there. The names (spellings / duplicates) are
  checked by the quicker model and asked again by itself.
* **"Log book status"** (a small button of the Maintenance Log Book's card): every **Own** machinery of the Asset Master (and any other
  with a bill) – its bills, **from**, **up to** (the last bill's date) and ₹; **"Not added yet"** first. Show: All / Not added yet /
  Added. Its **Show** opens that machinery's log book Start to end. ✕ / "Hide log book status" hides it.
* **"Hide log book"** after Show hides the log book shown again (and itself).
* Words and help in English, Marathi, Hindi (`app/i18n`; the help rule of update-183 at the end of `FIX_RULES`). New action
  `maintStatus` in `API_` (Maintenance or Reports) – it only reads.

## Code
| Where | What |
|---|---|
| `app/Code.gs` | `maintHasGa_` / `maintGstOf_` (a line's GST ₹ as given when no GST %); `maintLines_` keeps `gstAmt` (checked); `maintSpread_` leaves such lines out of the spread; `updateMaint_` / `maintLineSave_` keep it (an older app cannot change it); `readMaintLog_` `max` / `after` (a part of a page; `more`, `last`); `maintImportNames_` the quicker model; `API_.maintStatus` → `maintStatus_` |
| `app/App.html` | `mtHasGa` / `mtLineGst`; the form row `data-ga`; the import's lines `gstAmt` (no GST % made); `mlogRender` `asIs` (GST Amount); `mlLineEdit` `mll_ga`; `mliReadAi` (parts, asked again, `stop()` → `mliResume`, `#mti_more`); the names asked again; `#ml_stbtn` / `#ml_stbox` (`mlStatusShow` / `mlStatusPaint`), `#ml_hide`; `FIX_RULES`, `PAGE_GUIDE` |
| `app/i18n` | the new texts appended to `keys.json`; their Marathi / Hindi |
| `test/claude-standin.js` | logs the part asked (`part`, `after`) |

## Evidence
* Unit tests: **136 / 136** (`update-183`; the update-172 / 173 / 176 / 177 / 180 assertions moved to "as it is").
* Local test rig (PORTAL=1, RCLSTEPS=1, claude mode) – `test/browser/mnt183.js` **15 / 15**: his Excel (GST 12 %, 5 %, 28 % lines)
  read – each line its GST ₹ as in the file, no GST % made, the file's total; saved with `gstAmt`; the log book "GST Amount", no
  CGST / SGST %; a line's Edit (8 → 9 ₹); the whole bill keeps each GST ₹; Log book status ("Not added yet" first, from / up to, Show,
  ✕); Hide log book; a PDF page in parts (25 rows, then after the last row); the AI busy 3 times – asked again by itself; busy all the
  time – stopped, "Continue reading (from page 1)" goes on. Pictures: `mnt183_logbook.png`, `mnt183_status.png`, `mnt183_continue.png`.
* The older Maintenance tests moved to "as it is" and passing: `mnt182` 16 / 16, `mnt170` 20 / 20, `mnt173` 24 / 24, `mline180`
  15 / 15 (its View-only check made again when the page's heartbeat puts the real access back meanwhile), `mnt165` 32 / 32, `mnt168`
  29 / 29 (without RCLSTEPS, as written); the Portal's own test 119 / 119.
* `node --check` on `server/*.js`, `api/*.js`; the page's scripts parse; no secret in the change.

## Not verified
* The live Supabase / Vercel; the real Claude service (the rig uses its stand-in); a real phone.
* The log books imported before this update keep the GST % made then – he deletes them ("Delete this log book") and imports them again.

## Going back
Vercel → Instant Rollback to the previous update. Nothing to undo in the database (a bill saved with `gstAmt` is read by the older
update as a line without GST – import it again after going back).
