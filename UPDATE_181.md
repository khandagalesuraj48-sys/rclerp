# update-181 – a Material Supplier in the Vendor Master (28-10-2026)

**Asked (28-10-2026, 16:22, with the Store's import of his old inward register):** "STORE AMDHE JITH IMPORT CH OPTION AAHE … ATA AUTO
VENDRO AND ITEAM BAANYLA HAWET JEWDDE YA EXCEL MADHE AAHET VENDOR DETAIL JE BAKI PAN CARD ADHAR JE AAHE TE PENDING MI BHAREL NANTR".
His answer (asked): the suppliers go into **Mechanical's Vendor Master** as **"Material Supplier"** – kept out of the machinery and
billing lists. The Store (rcl-store `grn-import-register`) makes them; this update shows them and keeps them out of those lists. With
the phone app **3.57.0** (the same, as the app's own screens – not released yet).

**No database step of Mechanical.** The column `vendors.vendor_type` comes with the Store's `sql/store_step3_grn_import.sql` (or
Mechanical's old `supabase_step1p_vendor_type.sql`) – a site without it works as before (no type). Nothing saved is changed by the
update itself. No secret in any file.

## What changes
* **Vendor Master:** a vendor the Store made has **"Material Supplier"** by its name; a **Type** filter – All / Machinery & billing /
  Material suppliers (Store); the count of material suppliers in the line above the list. Its details (GST, PAN, Aadhaar, bank …) are
  filled as any vendor's.
* **The vendor's form:** **Vendor type** – Machinery / billing vendor · Material Supplier (Store) – where this site's database keeps it
  (`vendors.vendor_type`; else not shown). A page of before (no type sent) keeps the type as it is.
* **Not offered** for an asset's owner (Asset Master, Assign vendors), a BOQ (its vendor, the BOQ list's filter), a payment and the
  vendor ledger, the parties of the Log Book "Debit to", Machinery Billing and Saved Bills – **unless it already has machinery in the
  Asset Master or a BOQ** (then it is a vendor as any). Change its type in the form to make it a machinery / billing vendor.
* **A site whose database has no `vendor_type`:** an empty column is not sent while the table's columns are not known yet (an empty
  vendors table) – the save would be refused there (`'opt'` in `SupabaseSync.gs`, `toRecord_` in `SupabaseData.gs`).
* Words in English, Marathi, Hindi (`app/i18n`). No new server message, no new action.

**Also in this branch:** update-180's last commit (9baec79 – its new help rule moved to the end of `FIX_RULES`, so the earlier rules keep
their numbers for the phone app's copy of the help), pushed after PR #94 was merged.

## Code
| Where | What |
|---|---|
| `app/SupabaseSync.gs` | vendors: `['Vendor Type', 'vendor_type', 'text', 'opt']` |
| `app/SupabaseData.gs` | `toRecord_`: an `'opt'` column left out while empty and the columns not known |
| `app/Code.gs` | `MAT_SUP_`; `VENDOR_MORE_` + Vendor Type; `vendorOut_` `type`; `validateVendor_` `type`; `saveVendor_` puts it only when sent and `vendorTypeOn_()`; `vendorMatOnly_()`; `vendorNames_()` without them; `getBoqs_` `vtypeOn` |
| `app/App.html` | `matOnly` / `billVendors`; Vendor Master tag, `vf_ty`, count; form `v_type`; `dl_vendornames`, `bf_vendor`, `bOpen`, `m_selassign`, `pyVendors` |

## Evidence
* Unit tests: **134 / 134** (`update-181`: the type from the form and a row, the column's mapping, the parties' list, the page's lists).
* Local test rig (`test/browser/vtype181.js`, PORTAL=1): **16 / 16** – the type with the Vendor Master; the parties' list without
  them; one with a Rental machinery in it; the page's tag, the Type filter, the count; the form's type kept by a save of the details,
  changed to Machinery / billing (then in the parties' list); not in the owner / BOQ / new BOQ / payment lists; a save from a page of
  before keeps the type; a site without the column (T2): no type, a vendor saved as before. Pictures: `vtype181_vendors.png`,
  `vtype181_form.png`.
* The older vendor tests of the rig (vendors111api, dn, stale, site89, boq, boqhist132, billlock, backup): the same results on this
  update as on `main` (they fail on today's rig the same way on both – rig drift, not this update).
* `node --check` on `server/*.js`, `api/*.js`; the page's scripts parse; no secret in the change.

## Not verified
* The live Supabase / Vercel; a site that has run Mechanical's old step 1p (its vendors "As per BOQ" – shown as before, no tag).

## Going back
Vercel → Instant Rollback to the previous update. Nothing to undo in the database.
