# update-90 – new sites, stage 2: Super Admin, the sites of a person, site choice and switch (13-10-2026)

Asked by the owner on 12/13-10-2026: one app for every site, each site with its own database. A **Super Admin** designs the
system: sites, users and their access on each site, and companies (Rachana, Sketchline). He makes no entries and sees no
reports. Users and access are given **by the Super Admin only**, and a person's access is separate on every site. A person
with several sites opens his **default site** (Settings) or is **asked** which one. An **Admin is never asked**. The current
Admin makes the Super Admin (a new login of its own).

Live: update-89 (`1f3a85e`). **One SQL step: `sql/supabase_step7_sites.sql`, ONLY in the first site's database (VTR).**
It only ADDS 4 tables; not one existing table, row or column is changed. Nothing to set in Vercel for this update.

## What changes
| Who | What |
|---|---|
| **Before the SQL is run** | Nothing at all: sign-in, users and access work as before. The Admin's "Database" check shows one step to do (step 7). |
| **After the SQL** | Every user of VTR today is a user of site **S1** (VTR) – copied into the new list; nothing else changes until a Super Admin exists. |
| **Admin of VTR** | Users & Access → **Create Super Admin** (once): name, an email of its own (not a user's), a password. A **recovery code** is shown ONCE – write it on paper. From then on his Users page only **shows** users (a note says the Super Admin gives them). He keeps everything else: entries, reports, Company & site, screen-share rights. |
| **Super Admin** | Signs in on the same screen and gets his own screen with four tabs: **Sites** (name of each site, its company, "Check" its database), **Users & Access** (pick a site – the same table as before, for that site; add a person, give access, a one-time password), **Companies** (name, address, GSTIN, PAN, logo), **My account** (change password). No page of any site can be opened from his session. A forgotten password: sign-in screen → "Forgot password?" → "Super Admin: … recovery code" → a new password **and a new recovery code**. |
| **A person on several sites** | **One password everywhere.** A person put on a second site keeps his password. A password he changes, or a one-time password the Super Admin gives, is written on all his sites. |
| **Sign-in** | One site → it opens. Several sites: his **default site** opens; no default → **"Which site do you want to open?"** (a button per site). An **Admin** is never asked: the site he used last on this device opens (or the first one). The password is always checked on the person's first site, so 5 wrong passwords lock him for 15 minutes **whichever site is asked for**. The sign-in screen never shows another site's name. |
| **In the app** | With several sites, the site name is at the top (**⌂ VTR NH 848 ▾**). Pressing it opens another of his sites **without signing in again**. **Settings → My sites**: the site that opens at sign-in ("Ask me every time" / for an Admin "The site I used last"). |
| **Help** | EN / MR / HI: Users & Access, Settings; error help for the new messages. |

Not in this update: making a NEW site from the app ("Create site" – stage 3). The Sites tab shows the sites there are.

## An independent review (before delivery) – and what was changed after it
A separate review of the server and page code found no way to:
* reach the server's own functions from a page;
* use one site's session on another site;
* see a kept password on a page.

It found these, all fixed and tested:
* **Super Admin password guessing** – many guesses sent at the same moment could pass the 5-try limit. Every try is now counted BEFORE it is checked, as for users.
* **The "users are given by the Super Admin only" rule** – a moment when the database could not be read let a change through. Now such a moment refuses the change.
* **Wrong-password counting** – it was counted per site. It is now per person.
* **Restoring the site** after work inside another site cannot fail any more.
* **The Super Admin's email** may not be a user's on any site.
* **A new password that could not be written on another site** – the person is now told.
* **Sign-in** never waits for a far site's name.

## How it is built (for the next person)
* **Tables** (first site's DB, `public.rcl_*`, RLS on, service role only):
  * `rcl_super_admin` – one row only, enforced by the database
  * `rcl_companies`
  * `rcl_sites` – S1 = home: its database is the one in Vercel. Another site's key is kept LOCKED with `RCL_SITES_KEY` (needed from stage 3).
  * `rcl_user_sites` – email, site, admin mark, default
* **Every site keeps its own Users table** (its access per page – the app's access rules are unchanged). The server writes a
  person into a site's Users with that site's access and the same kept password.
* **Server code:**
  * `server/sites.js` – list of sites (15 s memory), lock, `homeRest`
  * `server/system.js` – login choice, `switchSite`, `setDefaultSite`, password to the other sites, the Super Admin's actions
  * `server/runtime.js` – `OUTSIDE` list: the server's own functions cannot be asked for from outside; `R.runIn` runs one of the app's functions inside another site
  * `app/Sites.gs` – runs inside one site: Super Admin sign-in / session `SA_…` / password / recovery; `sys*` for a person inside a site
  * `app/Code.gs` – `createSuperAdmin`; `saveUserAdmin` refused once a Super Admin exists; the step-7 check
* **Page:** `app/App.html` – `siteKeep`, `sitePick`, `siteSwitch`, `siteBoot`, the Super Admin screen `#sa_screen` (`saStart` …), `uaRender` / `uaBind` shared by the Admin's and the Super Admin's table. `server/page.js` – every call carries the site.

## Evidence (local rig; every command with a time limit)
| Test | Result |
|---|---|
| `site90api.js` (new; + "5 wrong passwords on his two sites in turn → locked"): before/after the Super Admin, creating him (refusals: not Admin, a user's email, a weak password, a second one – also by the database), his session opens no page of a site, a user's session cannot do his actions, Sites / Check (T2 through its locked key), Companies (GSTIN / PAN / https / same name), users on T2 only in T2's table, a non-Admin with 2 sites is asked, opening the other site without signing in (the old session ends), his access there, default site, Admin never asked, a brand-new person, one password on both sites (copied, changed, reset), taking a site away, the Super Admin's email cannot be a user, his password / recovery code / lock after 5 wrong tries, the server's own functions refused from outside (404), **VTR: of 26 tables only users / sign-in / sites tables changed – not one entry**, and a database WITHOUT step 7: everything as before | **75 passed, 0 failed** |
| `site90.js` (new, browser): computer – Admin with 2 sites not asked, site at the top, Create Super Admin (code shown), Users page read-only afterwards, Settings → My sites, the switch to T2 without signing in; phone – user with 2 sites asked, picks T2, sets his default; the Super Admin's screen covers the app, Sites / Check / Users & Access (a change saved in T2 only) / Companies / My account, his saved sign-in opens his screen again, sign out; no script error | **24 passed, 0 failed** |
| `site89.js` (stage 1, now with the list of sites; + the sign-in screen gives out no other site's name) | 38 / 0 |
| unit (+2: the step-7 SQL only adds, word for word in Read Me; the key lock) | 60 / 60 |
| The whole browser suite (83 tests) on the rig with the step-7 SQL run, after the review fixes: 0 failed in 67 of them – among them sweep 38, fold88 44, works69 34, screen72 23, viewbill 23, entry71 20, gap77 20, machno 19, rate69 19, access84 18, mobile86 18, big 18, splittime 18, billlock 17, settings 10, idle 10, start 8, cred 8 … | |
| The ones that failed – ai2, ai3, batch, clear, lg2, lists, meter, mob2, pend, photo85, rename, set2, stale, voice – fail **the same way, test for test, on the live update-89** on the same rig (they come from the rig's leftover data and older test expectations). media75 (1 fail) passed 21 / 0 twice when run again, and new3 fails now and then on live too (it reads a message during a 350 ms race). | same on live |

## Not verified / said plainly
* Real Supabase: the rig stands in for it. The SQL reloads the database's web layer (`notify pgrst`), as Supabase does by itself.
* Real phones. A second REAL site: that comes with stage 3 (until then T2 lives only on the rig).
* If BOTH the Super Admin's password and his recovery code are lost: in Supabase → SQL Editor (first site)
  `delete from public.rcl_super_admin;` – then the VTR Admin creates a new Super Admin (users and access are not lost).

## Going back
Vercel → Instant Rollback → update-89 (`1f3a85e`). The 4 new tables stay and do no harm (the older code does not read them).
Users and access given by the Super Admin stay in each site's Users table.

## To deploy (owner)
1. Deploy:
```
cd "C:\Users\aghug\Desktop\WEBSITE AND APP\rcl-fleet-erp"
git status
Expand-Archive -Path "$HOME\Downloads\rcl-update-90.zip" -DestinationPath . -Force
git status
git add .
git commit -m "update-90: new sites stage 2 - Super Admin, sites of a user, site choice and switch"
git push
```
2. Supabase (VTR project) → SQL Editor → New query → paste `sql/supabase_step7_sites.sql` → Run. The last line must say
   `sites: 1 · people on sites: N · super admin: 0`.
3. App (VTR Admin) → Users & Access → **Create Super Admin** → write the recovery code down.
