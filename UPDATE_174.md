# update-174 – the old log book's import for everyone with Maintenance Edit (28-10-2026)

**Asked (28-10-2026, 07:09, after merging update-173 and app 3.53.0):** "app release kr but he admin la fkt nahi user la pn disu de".

**No database step. Nothing saved is changed. No secret in any file.**

## What changes
* **"Import the old log book (Excel or PDF)"** (page Maintenance) is shown to **everyone with Maintenance Edit** – a user given
  Maintenance → Edit in Users & Access – not only the Admin (update-173). With **View only it is not shown** (an import saves bills).
  The Admin has Edit, so he sees it as before.
* **The server** (`API_`): `importMaint` – Maintenance **Edit** (no more Admin only), logged as before (`maintImport`);
  `checkMaintImport`, `readMaintLog`, `maintImportNames` – they save nothing, so they are **not marked as saves** (no verification, no
  sync) and **Edit is checked inside** (`maintEditOnly_`: "You have View access only for Maintenance. Ask Admin for Edit access.").
* **A person whose Maintenance is under verification** (the Super Admin's rule, update-114): his import is **sent for verification**
  as one request (saved when it is approved – as every save of the page); the sheet then says the "Sent for verification …" words in
  green, and the toast says them – not as a mistake. The Super Admin's import is saved at once, as before.
* **The guide** of the page (`PAGE_GUIDE` mnt, English / मराठी / हिंदी): "Whoever has Maintenance Edit can import the old log book …".
* **The phone app 3.53.0** (rcl-mobile, its own pull request): the same – the button for everyone with Maintenance Edit; a sent import
  said as sent.

## Evidence
* `timeout 300 node --test test/unit.test.js` → **127 / 127 pass**. The new `update-174` test: `importMaint` is Maintenance Edit and no
  more Admin only; the check, the AI's reading and the names are not saves (no Edit flag) and refuse View only ("You have View access
  only for Maintenance …") and let Edit in; the page shows the panel by `canEdit('Maintenance')`; a sent import is said as sent.
  `update-173` changed on purpose (the panel's line).
* `node --check` on `server/*.js` and `api/*.js`; the page's script blocks parse; acorn: no call lost; no secret in the change.
* **The local rig** (Claude stand-in): `mnt173.js` **16 / 16** (with "5. a user (not Admin) with Maintenance Edit sees the import;
  View only not; the Admin sees it"), `mnt170.js` **21 / 21**, `mnt168.js` **30 / 30**, `mnt165.js` **32 / 32**.
* **Not verified:** a real user of a site signing in through the Portal with Maintenance Edit (checked on the page and in the server's
  code, not with a second real account); his real files; a real phone.

## Going back
* Vercel → Instant Rollback to update-173 (the import for the Admin only again).
