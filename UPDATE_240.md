# update-240 – RCL HR opens at once from the rail (no list of its pages first) (no SQL) (13-11-2026)

**Asked (13-11-2026, with a picture of the rail and HR's pages beside it):** "ethun hr war click kel ki direct open houde te side
menu yene band kar".

## The change (`app/App.html` only)
A click on **RCL HR** in the left rail opens HR itself – the list of HR's pages is not shown here first. HR brings its own menu:
since its change of 13-11-2026 (rcl-hr PR #38) HR takes the whole window when this screen shows it, with its pages down its own
left side and "‹ ERP" / "‹ Portal" / "Log out" on top.

* `RAIL_DIRECT = { hr: true }` – the modules whose rail button opens the module itself; the click calls `extOpen('hr', '')`
  (HR's first page: its dashboard).
* Every other module (Store, Engineering, Purchase, Machinery, Admin) opens its pages as before.
* HR not served under this address (`extOpen` says no): its pages as before.
* Ctrl + K still finds HR's pages by name.

## Evidence
`timeout 300 node --test test/unit.test.js` – 187 pass (1 new test). `node --check` is not for this file (a page); its
script blocks were parsed.

## NOT run / NOT verified
The browser and API tests were not run. The click was **not tried in a browser** – on the local rig HR is not served under
Mechanical's address, so the rail has no "RCL HR" there. To be looked at on the live address after the merge: (1) the ERP opened
and left alone stays the ERP; (2) a click on RCL HR opens HR in the whole window; (3) "‹ ERP" comes back.

## Going back
Vercel → Instant Rollback to update-239 (then Overview → Manage → promote the newest deployment, so that later merges go live
by themselves).
