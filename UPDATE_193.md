# update-193 – the papers' company: told by the Portal (29-10-2026)

**Asked (29-10-2026):** "mala ajun pn old format distey yar reuirement print mhanle ki kay are yar", with a picture of his requirement's
print (Indent No. S1/PR/2026/0003): the new layout (Purchase Requisition Form, Project Name, Indent No. …), but its heading **empty** –
no logo, no company name, no address.

**Why it was empty:** the papers of the modules (the Store's PO and Purchase Requisition Form, `rcl-store` `api/work.js` `headingOf`)
read a site's company from **this app's list of sites** – the first site's `rcl_sites` (its `company_id`) and `rcl_companies` (name,
address, GSTIN, PAN, logo). That list was written only by the step-7 SQL (the first site, S1, with **no company**) and by "New site" (a
company with its **name alone**). A company saved in the Portal (Companies) and a site's company saved there (Sites) went only into the
Portal's own database – never here. So VTR (S1) has no company here, and the paper had nothing to print.

**No SQL.** No table or column is added; no row is changed by the update itself – only when the Super Admin saves in the Portal. No
secret in any file.

## What changes
* **The Portal tells this app** (the Portal's part: `rcl-portal` `api/admin.js` `papersTell`, its own pull request) whenever the Super
  Admin presses **Companies → Save** (the company: name, address, GSTIN, PAN, logo) or **Sites → Save** (that site's company; none =
  none), and after "New site" is ready – with the same signed ticket as "New site" (ES256, `aud` "mechanical-admin", one minute, used
  once), act **`papers`**.
* **Here** (`server/system.js` `portalAdmin` → `papersSet`; the ticket's part `papersOf` in `server/portal.js`):
  * the company: added to `rcl_companies` when it is not there, else its row changed (name, address, GSTIN, PAN, logo – a logo kept
    only as an https link, every value cut to the Portal form's size);
  * with `link` (a site saved): that site's `company_id` in `rcl_sites` (only a site in the list; nothing else of it – its name,
    status, database, Sheet stay); a site of the Portal not set up here: nothing;
  * a company alone comes with the site "PORTAL" (as Sites → Storage) and no `link`: no site is changed;
  * never a delete (a company deleted in the Portal stays here – nothing points to it);
  * no list of sites yet (step 7 not run): said, nothing written.
* Not told (this app not reachable, or not updated yet): the Portal's save stands, and it says "Saved. But the papers of the modules …
  could not be told (…) – save again in a minute."

**After it is live, he does once:** Portal → Super Admin → **Companies** → Rachana … → its address (and GSTIN, PAN) → **Save**; then
**Sites** → VTR (S1) → Company: Rachana … → **Save**. The requirement and the PO of VTR then print the logo, the company's name and its
address. (Optional: Store → Opening stock & Numbers → Papers → Prefix "RCL/VTR" makes the Indent No. "RCL/VTR/PR/2026/0003".)

## Code
| Where | What |
|---|---|
| `server/portal.js` | `verifyAdmin`: act `papers` → `papersOf(c)` (exported): `link`, the company cut to size |
| `server/system.js` | `portalAdmin`: act `papers` → `papersSet(c)` |
| `test/unit.test.js` | `update-193` |
| `test/papers193api.js` | the rig: Portal → here → the Store's heading |

## Evidence
* Unit tests: **146 / 146** (new `update-193`: the ticket's company cut to size, a logo only https, `link` only when true; `papersSet`
  adds a new company / changes one already there, sets a site's company only with `link` and only for a site in the list, takes it off
  when none, never a delete, nothing without the list of sites). The Portal's unit tests **16 / 16** (its new one: what is sent, when,
  and the warning).
* **Local test rig** (PORTAL=1, the Portal of the branch; never live) – the start as at the live sites (S1 with no company in this list):
  * the Portal's own test **123 / 123** (its saves now tell this app – nothing of it changed);
  * new `test/papers193api.js` **19 / 19**: Companies → Rachana Test Co → address, GSTIN, PAN → Save → the same here; Sites → S1 →
    Company → Save → S1 belongs to it here (its name, status, first site unchanged); **the Store's requirement at S1 (its `reqList`, the
    heading its print uses): the company's name, address and GSTIN** (before: empty); a new company added, a site given it, its address
    and logo changed, the site given none; a Portal site not set up here – nothing added; this app not reachable – the Portal saved it
    and said so, saved again – told; not the Super Admin – refused; the Activity record;
  * the Portal's page in a browser: Companies → Change → Save "Company saved."; Sites → S1 → Save "Site saved." (both told); this app
    not reachable: the red message "Saved. But the papers of the modules … could not be told (…) – save again in a minute."; no page error.
* `node --check` on `server/*.js`, `api/*.js`; `app/App.html` not changed; no secret in the change.

## Not verified
* The live sites: nothing live is changed until he saves the company and the site in the Portal (after both updates are live).
* Whether the Portal's live company "Rachana …" has its address, GSTIN, PAN filled – he fills them (they are his).
* A picture of the printed requirement with the heading (the rig has no requirement at S1; the Store's own print code takes the name
  and address from this heading – its own tests).
* A real phone (the app prints the same server's heading – not changed).

## Going back
Vercel → Instant Rollback to the previous update (here and in the Portal). What was told stays in `rcl_companies` / `rcl_sites` –
the previous update reads it the same way (the Store's papers keep their heading).
