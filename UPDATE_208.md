# update-208 – Head Office's Mechanical at its own address: `/ho/` (03-11-2026)

**Asked:** "aplela head office sathi apan je banwale aahe mechanical department te purn wegle karaych aahe tya sathi seprate link asel
tya link madhe kontich site yenar nahi fkt ani fkt mechanical wegle asel … baki mechanical ho che sagle aahe as fkt link dusri deyychi
aahe jya link madhe kontich site nasel". His answers (03-11-2026): **this same Vercel project, a new address**; **Head Office taken off the
main link**; **signing in through the Portal, which opens Head Office directly**.

**No database step. No new Vercel project, no new setting.** With the Portal's PR (`api/go.js`).

## What changes
* **The new address:** `https://oneclicksolution-erp.vercel.app/ho` (→ `/ho/`) – the same Mechanical app, **only the site HO**: no "Change
  site", no other site. Not signed in → the Portal's sign-in → Head Office opens there by itself. Everything of HO (its data, people,
  pages, its other modules such as Purchase when given) is as before – only the address is its own.
* **The main address** (`https://oneclicksolution-erp.vercel.app`) **never opens Head Office:** its "Change site" lists the other sites only.
* **Every way in goes to the right address by itself:** the Portal's card "HEAD OFFICE – Mechanical" (and a person whose start is HO) →
  `/ho/`; a link for HO that reaches the main address (a module's menu – Purchase / Store of HO –, `…/#site=HO&page=…`, a Portal ticket
  for HO) → `/ho/`, on the same page (the ticket is not used up on the way); a link for another site that reaches `/ho/` → the main
  address.
* **Both side by side:** the sign-in and the site of `/ho/` are kept in the browser under their own names (`rcl_token_ho`, `rcl_site_ho`, …),
  so a person can have the main address (e.g. VTR) and `/ho/` open at the same time, each on its own site.
* **People who used HO at the main address before:** the main address lets that sign-in go and the Portal opens his first other site
  there (no typing); HO opens at `/ho/`. A person who has only HO: the main address shows the Portal's page, where HO's card opens `/ho/`.

## Where
* `vercel.json` – `/ho` → `/ho/`, `/ho/` = the page (`/index.html`), no-cache. `dev.js` – the same for the rig. `app/sw.js` – `/ho/` opens
  without a network too (the same kept page).
* `app/App.html` – `HO_SITE`, `AT_HO`, `KK` (the address's own names in the browser), `siteHere`, `siteHome`, `siteFor`, `ticketSite`; the
  start (a ticket / a link of the other address goes there), `showLogin` (the Portal is asked for this address's site), `sideSite` (no
  Change site at `/ho/`), the Change site list (no HO at the main address), Settings → My sites (not at `/ho/`).
* `server/page.js` – the bridge: every call carries the site of its own address (`hoKey`).
* **Portal (`api/go.js`)** – Mechanical of the site HO is sent to `<Mechanical>/ho/`; everything else as before (the person's list, the
  ticket, the phone app – unchanged).

## Evidence
* Unit: `timeout 300 node --test test/unit.test.js` – 161 / 161 (new `update-208`: the rules run at `/ho/` and at the main address, the
  ticket's site read, no key used without its address's name, the routes; `update-99`, `update-160`, `update-194` now leave the `/ho` rules
  to it). The page's script blocks parse; `node --check` on `server/*.js`, `api/*.js`, `dev.js`, `app/sw.js`. Portal unit: 21 / 21.
* The rig in Chromium (test values only – a test site HO added for the check and taken out after), 13 / 13 with the Portal on its own
  address and 3 / 3 with ONE address (`/portal`, `/purchase` like live):
  `/ho` → the Portal's sign-in → `/ho/` with HO (the Portal sent it straight there), no Change site; the main address on S1 with Change
  site S1, T2 – no HO; `#site=HO&page=log` at the main address → `/ho/` on the Log Book, no new sign-in; both tabs opened again – each its
  own site; a kept HO sign-in at the main address → let go, S1 opens; the Portal's HO card → `/ho/`; HO's Purchase → inside Head
  Office's screen at `/ho/`; S1's Purchase → inside the main address's screen, as before. Pictures looked at.

## Not verified / not changed
* Not run on the live site. The live HO's code is `HO` (Decisions 26-10-2026) – the rule names that code.
* **The phone app: not changed** – it has its own screens and its own site list (HO is there as one of his sites, as before).
* **The reserve sign-in (`?local=1`) is as before** (its own site list still has every site).
* A screen-share / approval notification tapped while no app page is open opens the main address (as before); for an HO person that is
  the Portal's page → HO's card.
* **QR labels of HO's machinery:** printed from `/ho/` they carry `/ho/?m=…` and open HO. A label printed for HO earlier from the main
  address (`/?m=…` – no site in it) opens the main address, which has no HO – print it again from `/ho/`.

## Going back
Vercel → Instant Rollback to update-207 (and the Portal to its deploy before). Nothing in any database to undo.
