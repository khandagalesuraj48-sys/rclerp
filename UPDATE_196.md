# update-196 – the BETA copy (02-11-2026)

**Asked:** "ata ji erp apli chalu aahe ti live aahe ethun pudhe je kahi asel agodr testing hoil as like beta version sarkh … mi kahi
user la testing sathi deu shakel nantr jyana testing dile ahe tyana nai other la pn app web stable deu shakel … je cuurent chalu aahe
te bighdnar nahi"; then "beta setup chalu kr ani ha jewa stable war jaych asel tewa mala version wise button de je dable ki auto app
updet push hoil stable war web updet hoil mhanje prateklk weli code changes nko ani tula sarkhe nko sangahla".

**No database step here** (the Portal's step 7 is the only one). **Live (Production) does not change:** the beta copy exists only
for the branch `beta` with `RCL_CHANNEL = beta` set in Vercel for that branch. No entry, calculation, bill, ledger, stock or
permission changes.

## What changes (this repository)
* `server/syncfetch.js` – **`isBeta()`**: a Preview of the branch `beta` AND `RCL_CHANNEL = beta` (both). The guard of update-138
  ("a Preview works only with the TEST database") is skipped for it alone – the beta copy is the testers' copy on the **live data**.
  Any other Preview: refused on a database without the test mark, exactly as before.
* The beta copy makes **no backup and no Drive copy** (the live copy does them; two at once would copy twice) – `google.js`,
  `drive.js`, `pipeSync` unchanged (they already refuse a Preview). Its **notifications reach the phones** (`fcm.js`) – what testers
  save is live, their approvers must hear of it. No timed job runs on a Preview (Vercel runs crons only on Production).
* `server/page.js` – the beta copy's band: **"BETA – the new version for testers · the data is LIVE"** (purple), instead of the
  orange TEST band; and `window.rclLive` = the live address, so a **machinery label printed in the beta copy carries the live
  address** (`App.html` `qrLink`; `RCL_LIVE_URL` only if the one address ever changes) – a label stays on the machine for years.
* `vercel.json` – six rules for the beta address `rclerp-git-beta-pk12356843.vercel.app`: `/store`, `/purchase`, `/engineering`
  → their beta copies (`rcl-…-git-beta-pk12356843.vercel.app`); the Portal stays the one live sign-in. Before the live rules.
* `server/bkexport.js` – where Purchase / Engineering are for the backup: the **live** rule of `vercel.json` only (a host rule –
  staging or beta – is never taken). Found while adding the beta rules: without it the nightly backup would have read Purchase's
  beta copy.
* `BETA_SETUP.md` (new) – the owner's one-time set-up, in Marathi.

## The other repositories (the same piece of work, branch `beta-setup` each)
* **rcl-portal** – step 7 (`users.tester`, `modules.beta_url`); Users & Access → User Details → **Tester** ("Beta" mark in the list);
  Modules → **Beta link**; a tester's dashboard, `/api/go` and the app's list give the beta links; a new **Versions** tab:
  **New beta version** (the app's workflow `beta`) and, per version, **Give to everybody (Stable)** (each repository's `main` moved
  forward to the tested commit – nothing when one cannot – the release made stable, every phone told). `lib/beta.js`, `lib/releases.js`.
* **rcl-store, rcl-purchase, rcl-engineering** – the same `isBeta()` in `lib/preview.js`; `/api/me`, `/api/sso` say `beta`; the page's
  purple band.
* **rcl-mobile 3.73.0** – a tester takes the beta versions (pre-releases) and listens to `rcl-app-update-beta`; `beta.yml`,
  `tell.yml`, `tool/next_build.sh` (every build number above all releases – `release.yml` too); labels keep the live address.

## Evidence
* Unit: rclerp **149 / 149** (new: "the BETA copy" – the band, the phones, no backup / Drive, every other Preview as before, the
  rules of `vercel.json`, the live label address; update-127 / 194 / 195 now look at the live rules only); rcl-store 50 / 50,
  rcl-purchase 7 / 7, rcl-engineering 22 / 22 (the beta copy: the live data without the mark, its band; branch or channel missing →
  refused); rcl-portal 19 / 19; the Portal's rig `test/api.test.js` **130 / 130** with these changes.
* Rig, rcl-portal `test/beta.rig.test.js` **2 / 2** (tester routing; Versions; Give to everybody: refused as a whole when a `main`
  cannot move forward, else the tested commits, the web first and the app last; a version of the web only never becomes the app's
  "latest"; one press at a time; New beta version) – a stand-in for GitHub, nothing reaches it.
* Rig, rcl-portal `test/beta.e2e.rig.test.js` **2 / 2**: the beta copies of Mechanical (:3002) and the Store (:3021) started from
  these trees with `VERCEL_ENV=preview`, `VERCEL_GIT_COMMIT_REF=beta`, `RCL_CHANNEL=beta`, on the rig's databases, which carry no test
  mark (like live): a tester is sent there by the Portal, signs in with its ticket and reads; the BETA band and the live label
  address; a Preview of another branch (:3003, :3022) is refused on the same databases; a non-tester is sent to the stable copies.
* The Portal's screens in Chromium (desktop and phone width): the Tester switch, the "Beta" mark, the Beta link column, Versions
  with Give to everybody and New beta version.

## Not verified
* Vercel itself: the branch address `rclerp-git-beta-pk12356843.vercel.app` (the same form as staging's), the branch-scoped
  settings overriding the Preview ones (Vercel's documented behaviour), the rewrites to the beta projects.
* GitHub itself: the fine-grained token moving `main` (a protected `main` would refuse – then "Give to everybody" says which),
  the workflows `beta` / `tell` on GitHub's machines (their steps were run here with a stand-in for `gh`; the app's build steps are
  those of `release.yml`).
* A real phone taking a beta version; Firebase's beta topic.

## Going back
* Nobody ticked as tester / no beta link: everybody on the stable copies, as today. `RCL_CHANNEL` removed in Vercel: the beta copy
  is a plain Preview again (refused on live).
* Vercel → Instant Rollback to the previous deployment (this update changes nothing for Production).
