# update-95 – "New site" from the Portal (13-10-2026)

Asked by the owner on 13-10-2026: the Super Admin makes a new site himself, without any code change. He fills a form, the
system checks everything and sets the site up. Secret values go into Vercel (the form says which). Everybody keeps using the
one main link (the Portal). The first new site is **18B Kolhapur**.

Mechanical stays **one app for every site; a site is its own database**. There is no second Vercel project.

## The form – Portal → Super Admin → Sites → + New site
The Super Admin first makes the site's Supabase project himself (region Mumbai). Then he fills in: site code, site name,
company, the project link, and (optionally) the Google Sheet for its backup. **Check & set up** works through a checklist.
It stops at the first step that is not done, says exactly what to do, and can be pressed again any number of times:

| # | Step | What the form says when it is not done |
|---|---|---|
| 1 | The project link | It must be the project's own address, `https://<20 letters>.supabase.co`. A link already used by another site is refused, and a ready site keeps its database. |
| 2 | The secret key **in Vercel** | Vercel → rclerp → Environment Variables → `SITE_<CODE>_KEY` (e.g. `SITE_18B_KEY`) = the project's Secret key → Redeploy. **The key is never typed into the Portal and never stored in any database.** |
| 3 | The database answers with that key | Says whether the key is not this project's, or the database did not answer. |
| 4 | Mechanical's tables | **Copy the SQL** (every step of Mechanical in one piece, the same files as Read Me, without step 6 keep-awake and step 7) plus **Open its SQL Editor**: paste, Run, press Check again. The check is the Admin's own "Database" check (every table, column and function). |
| 5 | Company settings | Copied from the first site: the company, bill names (Rachana, Sketchline), logo and opening film, with the new site's own name. A site that is already ready keeps its own settings. |
| 6 | Ready | The site is **Active** in the Portal (it waits as Closed before) and *ready* in Mechanical's list. Next: Users & Access → pick the site → give people Mechanical, and their Pages. |

* **Nothing of another site is copied:** no machinery, no entries, no users.
* People open the new site through the Portal like any other. Whoever has two sites sees both.
* **Nightly backup:** it now copies every ready site that has its own Sheet, each into its own Sheet, side by side. Before,
  it copied only the first site. Share the Sheet with the service account's email (the form shows it) as Editor.

## Evidence (local rig – never live)
* **`test/newsite95.js` (new): 27 / 27**, end to end through the Portal with a **blank** database:
  * the link checks;
  * the key missing → the form names `SITE_N3_KEY`;
  * the rig is restarted with the key, as after a Redeploy;
  * the database answers; tables missing;
  * Copy the SQL → it runs in the blank database **without one error**;
  * company settings copied → Ready, Active in the Portal, the key stored nowhere, nothing of another site copied;
  * a user given the site opens it through the Portal and is written into its Users;
  * "Check" again keeps the site's own settings, and a ready site cannot be moved to another database;
  * only the Super Admin can do it.
* The new-site SQL in a blank database gives exactly the same tables, columns and functions as the first site. The one
  exception is `vendors.vendor_type` (step 1p); the app never uses it and Read Me does not list it.
* `test/backup.js` 30 / 30. It first failed on the rig because T2 has no Sheet; the nightly job now leaves out a site without one.
* Unchanged: unit 61 · portal91api 40 · portal94api 17 · browser portal91 20 · site90api 75 · site89 38.
* Portal: API 78 · browser 29 (the form and its first steps) · unit 6.

## Not verified
* Not run on live, nor on a real new Supabase project. The rig's blank database stands in for it. Supabase may switch on extra
  settings for new projects.
* The nightly backup of a second site into its own **real** Google Sheet. On the rig there is one stand-in Sheet only.
* site89 failed once (one row of the first site's cache, while the rig had just run other tests), then passed four times in a
  row. A session renewing itself during that test is the likely cause, but this was not proved.

## Going back
Vercel → Instant Rollback (Mechanical to update-94). A site already made stays in the lists. Delete its `SITE_<CODE>_KEY`
to switch it off.
