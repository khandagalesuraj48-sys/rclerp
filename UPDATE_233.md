# update-233 – the HR module under the one address: `/hr` (no SQL) (12-11-2026)

**Asked (12-11-2026):** the HRMS module is planned (Project doc `architecture/RCL_ERP_HRMS_Plan.md`); he made its Supabase
project, its repository `rcl-hr`, its Vercel project (`rcl-hr.vercel.app`) and its row in the Portal → Modules (key `hr`), and:
"a and b doni de" – (A) the module's frame in `rcl-hr` (its own pull request), (B) this: the address and the menu's icon.

## What is added
* `vercel.json`: `/hr` → `/hr/`; `/hr/` and `/hr/…` are sent to `https://rcl-hr.vercel.app` – as for the Store, Engineering and
  Purchase. Added after the older rules; `/ho/` (the Head Office site) is another address and is as before.
* `app/App.html`: the rail's icon of the module `hr` (`NAV_IC`). The button itself appears by itself for a person who has HR in
  the Portal (the menu follows the Portal's list) – nobody has it yet.
* Nothing of HR is in this app or its database. No server code, no action, no SQL.

## Evidence
* `timeout 600 node --test test/unit.test.js` – 185 pass, 0 fail (new: `update-233`; `update-99`'s and `update-194`'s lists updated).

## Not verified
* On Vercel: `https://oneclicksolution.online/hr/` after BOTH pull requests are merged (this one and `rcl-hr`'s frame).
* The module's page inside Mechanical's screen with a real sign-in – nobody has HR access yet.

## Going back
Vercel → Instant Rollback to update-232 (`/hr` then answers "not found" again).
