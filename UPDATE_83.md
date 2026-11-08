# update-83 – the search (Ctrl + K) finds anything in the app, also with a spelling mistake (12-10-2026)

Asked by the owner on 12-10-2026: "the search console (Ctrl + K) must be improved: whatever I type, it must work – if I type annd,
Anand must come; spelling mistakes too, with suggestions; anything in my app; a vehicle's reading – where it is, in the Log Book or
the Diesel Issue – as a suggestion, and I go there and see it. A universal search of the app."

No database step, nothing to set in Vercel. Live is update-82 (`716626a`).

## How it finds (one matcher – the page and the server have the same one)
* Every word typed must be found in the entry, in any of its fields. A word is found as the whole word (best), the start of a
  word, inside a word, or without dashes / spaces (`n83jcb` = `N83-JCB`, `ch8371` = `CH-8371`).
* **Spelling:** when nothing at all is found exactly, it searches again allowing a mistake – a word of 4 letters or more with one
  mistake (two from 7 letters): a letter missing, extra, wrong, or two swapped; also at the start of a longer name
  (`annd` → `Anand`, `Anandrao`). It then says **"Did you mean anand?"** (a press puts it in the box). A word that is right is
  never "corrected" (exact first, so no noise).
* **Numbers:** the same number in a reading, a quantity or an amount (`3714.5` = `3714.50`), the start of a number, or inside an
  ID / bill no. In the Log Book a reading is also found when it lies **between the Start and the Close** of an entry
  ("3716 is in between 3,714.5 → 3,717.5").
* Every result says **where** it was found: "found: Driver: Anandrao Patil", "found: Start Hrs: 3714.5", "found: Hrs reading: …".
* Best match first, then the newest; at most 8 of each kind, and how many there are in all ("23 found – the best 8").

## What it searches (each kind only for a user who may see its page)
| Kind | Searched in | A press opens |
|---|---|---|
| Pages, quick actions, machinery, owners (as before) | name, type, make, owner, engine / chassis no (as each user sees them) | as before |
| Diesel issues | ID, machinery, driver, remark, owner, type, source, date, qty, **KM / Hrs reading, pump meter** | Diesel Issue on that ID (as before) |
| Log Book | machinery, date, shift, work, chainage, driver, challan, remark, debit to, the works of the shift, **Start / Close KM and Hrs (and in between)**, time, trips | Log Book on that machinery and date (as before) |
| Diesel inward / transfers | ID, pump, bill no, location, date, qty, amount, remark | as before |
| Tank checks *(new)* | ID, machinery, date, reason, checked by, litres | Tank Check on that machinery and date |
| Breakdowns *(new)* | machinery, reason, remark, from date | Breakdown on that date |
| Vendors *(new)* | name, GST, PAN, phone, email, bank, address | Vendor Master filtered to the vendor (an owner of the same name: one result with a "Vendor" button) |
| Bills, debit notes *(new)* | bill / note no, vendor, company, period, date, amount | Saved Bills for that vendor and period |
| Payments *(new)* | ID, vendor, date, amount, mode, reference, against bill | Payments on that vendor and date |
| BOQ / work orders *(new)* | BOQ no, WO no, vendor, date, machinery | Vendor BOQ of that vendor |
| Vehicle papers *(new)* | machinery, paper, paper no, renewed on | Vehicle Compliance filtered to the machinery |

Not searched (said plainly): the bank account / Aadhaar numbers of vendors, users, the Activity Log, reports.

## Files changed (against update-82)
| File | Change |
|---|---|
| `app/Code.gs` | `globalSearch_` rewritten with `gsDist_`, `gsField_`, `gsWordHit_`, `gsRecord_` (new) – more kinds, where found, counts, the spelling to suggest, exact first / then with mistakes |
| `app/App.html` | the search: the same matcher (`gsRecordP` …), the new kinds and where each opens, "Did you mean", owner + vendor as one result, the box's hint text; `loadTankChecks` keeps only the newest answer; Dashboard help (EN / MR / HI) describes the search |
| `test/unit.test.js` | 1 new test (57 in all) |
| `test/browser/search83.js` | new |
| `UPDATE_83.md`, `HANDOVER.md` | notes |

## Evidence (local rig)
| Test | Result |
|---|---|
| `search83.js` (real page): `annd` finds the Log Book entry and the diesel issue of driver "Anandrao Patil" ("found: Driver: …") and asks "Did you mean anandrao?", pressing it fills the box; `3716` finds the Log Book entry 3714.5 → 3717.5 it lies in; `3714.5` finds it in the Log Book (Start Hrs) and the Diesel Issue (Hrs reading), and the result opens the Log Book on that machinery and date with the entry in the list; `n83jcb ch8371` finds the entry; `sainth earthmovers` finds the vendor – owner and vendor are one result, its "Vendor" button opens Vendor Master filtered to it; nothing found → a plain message, no wrong suggestion; each search under 3 s; no script error | 13 / 0 |
| unit: `annd` → Log Book + Diesel Issue + "did you mean ANAND"; `sai earthmovres` → the vendor; `3714.50`, `3716` (in between), `t83jcb ch4471`; nothing for `zzzq`; a correct word is not corrected; a diesel-only user gets no Log Book / vendors, a user with no access gets nothing; the page's matcher gives the same answers as the server's | passed (57 / 57 with net) |
| saveonce 44 / 0 · secure68 48 / 0 (incl. "the hidden master figures are in no answer of the search") · sweep 38 / 0 · least68 9 / 0 · hardenpage 10 / 0 · tank 7 / 0 · brand 13 / 0 · logo79 6 / 0 | passed |

## Not verified
* Speed on the live site with all its entries (on the rig a search answers in 20 – 100 ms; the web server keeps the tables in
  memory, so it should stay quick – not measured there).

## Going back
Vercel → Instant Rollback → update-82 (`716626a`). Nothing is stored by this update.

## To deploy (owner; no SQL)
```
cd "C:\Users\aghug\Desktop\WEBSITE AND APP\rcl-fleet-erp"
git status
Expand-Archive -Path "$HOME\Downloads\rcl-update-83.zip" -DestinationPath . -Force
git status
git add .
git commit -m "update-83: universal search - spelling mistakes, readings, every kind, where found"
git push
```
Vercel "Ready" → Update in the app → press **Ctrl + K** and type, e.g. a driver's name with a mistake, or a meter reading.
