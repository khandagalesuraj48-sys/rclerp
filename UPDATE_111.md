# update-111 – Every site its own vendors (15-10-2026)

**Asked:** "vtr che vendor ani item vtr la rahude, 18 b che 18 b la – mix nko kryaal, gondhal honar nahi". This replaces update-106
("one Vendor Master for every site"). The Store's Item Master is changed the same way in the Store's own repository.

## How it works now
* Each site sees and uses **only its own vendors**: the Vendor Master page and every place a vendor is picked (Asset Master owner,
  BOQ, Machinery Billing, Payments, Ledger, Debit Note party, Log Book "Debit to", the search).
* A vendor saved, changed or deleted at a site stays at that site. **Nothing is copied to another site any more.**
* Since update-106 a site's database may hold **copies** of another site's vendors. Such a copy:
  * is not shown and cannot be picked, changed or deleted at this site;
  * **unless this site already uses it** – an asset's owner, a BOQ, a bill, a payment, a debit note or a Log Book "Debit to" of
    this site. Then it stays this site's vendor (shown, changed, used here; a save makes it this site's own), so no bill or
    ledger of this site loses its vendor;
  * a NEW vendor of the same name made at this site takes that row over and becomes this site's own (nothing added twice).
* **Nothing is deleted from the database.** The copies only stay out of sight.
* "Vendors of all sites" (the Admin's button) is removed.
* If the database cannot be asked whether a copy is used here, nothing is hidden at that moment (better one vendor too many than
  one of this site missing).
* No SQL step. Step 1y (`owner_site`) stays as it is.

## Evidence (local rig, test data only)
* Unit: 76 / 76 – "update-106 → update-111" (no site asks another, nothing copied, the button gone, help for the new message in
  English / Marathi / Hindi) and "update-111" (a copy not shown / not a party / not changed / not deleted; one used by an asset
  or a bill shown; a new vendor of the copy's name is this site's own; an edit makes a used copy this site's own; when the
  database cannot be asked nothing is hidden).
* Rig, two sites (`test/vendors111api.js`) 12 / 12: saved at S1 stays at S1, saved at T2 stays at T2; a copy at T2 not shown, not
  in the Payments list, not changed, not deleted; a copy T2 pays (name with a comma and quotes, asked from the real database) is
  shown and becomes T2's own when changed; a new "V111 Gamma" at T2 takes the copy's row over; S1 untouched.
* Browser: boq 8, debit 5, dnui 8, viewbill 23, idle 10.
* master75.js stops at "Users and access are given by the Super Admin only" – an old test from before update-90, not about vendors.
* Removed with the feature: `test/vendors106api.js`, `test/browser/vendors106.js`.

## Not verified
* Not run on the live data. If live had "Vendors of all sites" pressed, each site has copies of the other's vendors: after this
  update the ones a site uses stay with it, the rest are hidden.

## Going back
Vercel → Instant Rollback to update-110. Nothing in the database was changed by this update (vendors saved after it carry this
site as owner, which the older code also understands).
