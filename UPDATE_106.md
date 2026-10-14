# update-106 – The Vendor Master common to every site (14-10-2026)

**Asked:** "iteam master and vendor master he common asel – ekde add kel ki tikde pn distil; fkt vtr sathi add zalel 18 b la edit
nahi krta yenar delet karta nahi yenar … show sagle site la karel but edit and delet tyach site la … box disel ki tumhi he edit or
delet kru shakat nahi, to vendor koni banwala aahe te sangel … jyala sangel tyala vtr cha access ani master cha access asne grjech."
His choices (14-10-2026): a copy in every site's database; the vendors each site already has brought together, the same name = one.

## How it works
* Every site keeps a **copy of every vendor** in its own database. Its BOQs, bills, ledgers and reports read it exactly as
  before; nothing of the billing changed.
* A vendor carries the **site that made it** (`vendors.owner_site`, SQL step 1y).
* **Save / rename at the owner site:** the vendor is written at every other site too. A rename takes everything that holds the
  name there as well (assets, BOQs, bills, payments, debit notes, Log Book, diesel), as at home.
* **At another site:** the list shows "made at VTR NH 848 · Sujit". Edit and Delete show a box: which site and who made it, and
  that it is changed only there, by a user with Vendor Master edit access at that site. The server refuses it as well.
* **Delete:** only at the owner site, and only when **no site** has a BOQ or an asset of it. The message names the site that
  uses it.
* **"Vendors of all sites"** (Admin, Vendor Master): brings together the vendors each site had before.
  * The same name is ONE vendor. Its owner is the site already marked as owner, else the site that saved it first.
  * Its details are the owner's.
  * It first shows what each site gets and every detail that would change at a site. Then, on yes, it writes.
  * Nothing is deleted. Running it again does nothing more.
* **A site that cannot be reached when a vendor is saved:** the vendor is saved here, and a box names that site.
  "Vendors of all sites" brings it up to date later.
* **The Item Master** (Store) is common the same way: Store pull request "Item Master common to every site". There each item
  stays in its own site's database and the list reads every site, so the Store needs no SQL.

## SQL (he runs it) – `sql/supabase_step1y_vendor_owner.sql`, in EVERY site's Supabase (VTR NH 848, 18B …)
```
alter table public.vendors add column if not exists owner_site text;
notify pgrst, 'reload schema';
```
* It only adds an empty column and is safe to run twice.
* Until it is run at a site, that site keeps its own vendors as before, and the Vendor Master says the step is needed.
* After it is run at every site, the Admin presses **Vendor Master → "Vendors of all sites"** once.

## Evidence (local rig: S1 = VTR NH 848, T2 = Test Site T2)
* **`test/vendors106api.js` 17/17:**
  * before step 1y: as before;
  * after it:
    * a vendor made at S1 is copied to T2 (owner S1, its details, who made it);
    * at T2 its change and delete are refused, with the site and who made it;
    * a vendor made at T2 reaches S1;
    * a rename at S1 renames it at T2 together with its BOQ there;
    * a vendor used at T2 is not deleted at S1; once free it is deleted at both;
    * "Vendors of all sites": the check (42 vendors), the bringing together (both sites have all, every vendor has its owner,
      nothing deleted), and a second run with nothing left to do.

  The rig's vendors were put back afterwards.
* **`test/browser/vendors106.js` 5/5**, at T2:
  * "made at VTR NH 848 · Sujit" and the note;
  * the box on Edit and on Delete (no form, nothing deleted);
  * "Vendors of all sites" shows the plan before anything is written.
* Unit tests: 70/70 (new "update-106"). It also checks that the other sites are asked only through the server, never from the
  page.
* `node --check` passes; the page's script blocks parse.

## NOT verified
* On the live databases (VTR and 18B).
* With a slow or unreachable second site in real conditions. On the rig both sites answered.

## Going back
* Vercel → Instant Rollback (rclerp). The column can stay; it is not used then.
* Copies already made at another site stay: they are ordinary vendor rows.
