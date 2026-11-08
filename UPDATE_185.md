# update-185 – the assistant knows the rest of the ERP: Mechanical's other pages, the Store and Engineering (28-10-2026)

**Asked:** "the AI is to be the app's main brain" (04-10-2026), and today (28-10-2026) for every module: Ask answers from maintenance, bills, payments, ledger, outstanding, vendors, BOQ,
compliance, breakdowns, fuel cards, inward / transfer, machinery cost, and the site's Store (stock, GRN, issue, requirements, PO) and
Engineering (plans, reports, progress) – read only, with the person's own access; web and app. With the Store's branch **store-ask**,
Engineering's branch **eng-ask** and the phone app **3.59.0**.

**No database step.** Nothing is saved, changed or deleted by the assistant. No secret in any file.

## What changes
* **15 new look-ups of Mechanical, run by the server** (new action `aiLookup`): Maintenance bills, a machinery's Maintenance Log Book,
  Log book status, Saved Bills, Machinery Payments, Vendor Ledger, Vendor Outstanding, Vendor Master, Vendor BOQ, Vehicle Compliance,
  Breakdown, Fuel Cards, Diesel Inward, Diesel Transfer, Machinery Cost Sheet. Each first checks the person's own access to the page it
  reads – **the same check, in one function (`apiAccess_`), as when he opens that page** (View is enough – it only reads); a person
  without it gets the page's own words ("You do not have access to Maintenance. Ask Admin."), which the AI tells him.
* **A machinery or a vendor in his own words:** "rl 185" is RL-185; a part of a name is the one machinery / vendor it fits; when it
  fits several, the AI is told which and asks.
* **The Vendor Master look-up never gives the Aadhaar, PAN or bank account NUMBERS** – only whether they are there ("missing: PAN,
  bank account …"), the mobile, email, GST, bank name / branch / IFSC and the documents (by kind).
* **9 look-ups of the Store and 5 of Engineering, asked of those modules themselves** (their new action `aiLook`), with the person's
  sign-in THERE – the Store's own pages / reports and Engineering's Admin / User decide what he sees. The page asks a module of the
  same address (the one screen); when the module has no sign-in here yet (or of another site), its page is opened unseen – it signs in by
  itself, as from the menu – and the look-up is asked again. A module at another address: the AI is told so.
  * Store: stock (now / on a date, below min), stock statement, an item's ledger, Inward (GRN) register, Issue (Outward) register,
    consumption (by party / machinery / use for / location / item), returnable items, requirements, purchase orders.
  * Engineering: his own work (plans and reports), the dashboard of a day, the report of a period, the performance, the progress
    (strip chart) – the dashboard, report and performance for the Admin and the Super Admin, as their pages.
* Each answer is made short for the AI (the totals, the first rows, ~14,000 characters; "only the first N … are given" when cut).
* "Looked up: …" names them (Maintenance bills · rl 185, Store – stock · cement …). Words and help in English, Marathi, Hindi (the help
  rule of update-185 at the end of `FIX_RULES`).

## Code
| Where | What |
|---|---|
| `app/Code.gs` | `AI_TOOLS_` +29 (15 Mechanical, 9 Store, 5 Engineering); `AI_LOOK_` (the 15, each with the actions it reads), `aiLookup_`, `aiFit_`, `aiPick_`, `aiMachine_`, `aiVendor_`; `API_.aiLookup` (withUser); `apiAccess_` – the access check of `api()` moved into one function, used by both |
| `app/App.html` | the look-ups: `AI_RUN` first, then `store_*` / `eng_*` → `aiModLook` (the module's `aiLook`, its sign-in of this site, its page opened unseen when needed), else `aiLookup`; `AI_NAMES`; `FIX_RULES` |
| `app/i18n` | the new texts appended; Marathi / Hindi of what the person may see |
| `test/claude-standin.js` | "LOOKUP <name> <JSON>" asks for that look-up; its log keeps the result |
| rcl-store `lib/ailook.js`, `api/work.js` | `aiLook` – through `ACTIONS.report` (the Store's access), the report as named columns |
| rcl-engineering `lib/ailook.js`, `api/eng.js` | `aiLook` – through `A.days` / `A.dash` / `A.report` / `A.perf` / `A.strip` (their access) |

## Evidence
* Unit tests: Mechanical **138 / 138** (`update-185`: the list, read actions only, the access words, no Aadhaar / PAN / account number,
  machinery / vendor in his words, the answer cut; the update-167 / 0-tool counts moved to 40); the Store 30 / 30, Engineering 19 / 19.
* Local test rig – `test/browser/ai185.js` (no Portal, Claude stand-in) **10 / 10**: maintenance bills of "rl 1850" from the database
  (₹767 – 650 + its GST ₹117 as in the file), its Maintenance Log Book, Log book status; the vendor without the numbers; a vendor not of
  the site said; compliance; Saved Bills, Payments, Outstanding, BOQ, Breakdown, Fuel Cards, Inward, Transfer, Cost Sheet each answer.
  `claude167` 14 / 14 (40 look-ups sent).
* The rig in gateway mode (the one address, as live) – `test/browser/ai185gw.js` **7 / 7**: Mechanical's Ask asked "store stock of
  cement" – the Store had no sign-in in this browser: its page opened unseen (the person stays on his page), signed in, the Store's own
  Stock report answered (Cement OPC 53: 42 Bag); the requirements at once with that sign-in; Engineering the same (its progress, the
  week's report for its Admin); the Store's refusal of an item not there reached the AI; no page error. Picture `ai185gw_ask.png`.
* The modules' own rig tests with their new aiLook checks: the Store's `work.test.js` **86 / 86**; Engineering's `api.test.js` 89 / 90 –
  all 8 aiLook checks pass, the 1 other is a person's name on the rig ("Sujit" expected, "Sujit Test" there), not touched by this.
* The older tests whose numbers change with the 40 look-ups: `claude167` 14 / 14, `ai` (Gemini) 13 / 13 (its name check made to
  take the rig's name); `ai185` again 10 / 10. `ai2`, `ai3`, `aido` (Gemini) fail the same on update-184 without this change (they need the rig's old diesel data).
* `node --check` on `server/*.js`, `api/*.js`; the page's scripts parse; no secret in the change.

## Not verified
* The live Supabase / Vercel; the real Claude service (the rig uses its stand-in – what the real model asks is its own choice); a real phone.

## Going back
Vercel → Instant Rollback to the previous update (and the Store / Engineering their own). Nothing to undo in a database.
