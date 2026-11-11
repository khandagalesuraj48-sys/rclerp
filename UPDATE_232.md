# update-232 – One Click Solution's first page: the company's code, then that company's own sign-in (no SQL) (12-11-2026)

**Asked (12-11-2026):** "erp aahe one click solution chi … one click open kel ki user adhi compny name takel ki konte compny madhe
jayche ahe … USER RCL TAKEL MG RCL CHE PAGE YEIL ANI RCL CHE FKT USER LOGIN KRU SHAKEL … MILESTONE AS USER LIHIL TR MG TYAAL FKT
MILESTONE ASEL RCL NAHI ACCESS". His answers: every company has its OWN database; the user TYPES the code (no list is shown);
Milestone is not made yet. The look (his words: "MALA WHITE SCREEN HAWEY ONE CLIACK SOLUTION MOTHA LOGO ANI … SHORT MAHITI IMAGES
MADHU" → "YES HECH BANAW"): a white screen, the big One Click Solution logo, the code box, six picture cards on the ERP.

## What is added
* `app/company.html` → `<main address>/company` (`build.js`, a rewrite in `vercel.json`). No company is named on it. The right code
  opens that company's sign-in; a wrong one: "This company was not found…" (English, Marathi, Hindi). The company chosen on a
  device is remembered there (`localStorage` `ocs_company`) – its sign-in opens by itself the next time; `/company?change` forgets it.
* `api/company.js` – `GET /api/company?code=RCL` → `{ ok, code, url }` or `{ ok: false }`. One code asked, one answer: the list is
  never given out. The list lives in Vercel → Environment Variables, not in this public repository:
  `OCS_COMPANIES = RCL=/portal/,MILESTONE=https://<its address>/portal/`. **Not set = only RCL, at this address's own Portal** –
  so nothing has to be set today. Only a path of this address or an `https://` address is accepted.
* `app/icons/co-*.png` – the six pictures (Microsoft Fluent UI Emoji, MIT – the same ones the sign-in page uses; the licence file
  is beside them).
* The Portal's part (its own pull request, `company-gate`): under the one address a device that has not chosen its company is sent
  to `/company` before the sign-in; the sign-in shows "Company: RCL · Change company"; `/portal/#signin` opens the sign-in without it.

## What is NOT changed
* No SQL, no data, no user, no password, no access. Who may sign in is decided as before by the company's own Portal – the code
  only chooses WHICH company's sign-in opens. A person already signed in sees no difference.
* The phone app (it has its own sign-in screen; the company's code in the app = a later version).
* A second company (Milestone): its own Supabase projects and Vercel projects are made when he asks; then one line in `OCS_COMPANIES`.

## Evidence
* `timeout 600 node --test test/unit.test.js` – 184 pass, 0 fail (new: `update-232`; `update-99`'s list of rewrites updated).
* A real browser (Playwright) on a local copy of the two pages – no live server, no data: `/portal/` without a company → `/company`;
  `abcd` → "This company was not found"; ` rcl ` → `/portal/`, the sign-in with "Company: RCL · Change company"; `/company`
  again → straight to the sign-in; "Change company" → the empty box; `/portal/#signin` → the sign-in; a 390 px phone: no sideways
  scroll; no page error.

## Not verified
* On Vercel itself (the rewrite `/company`, the function `/api/company`) – after the merge: open `https://oneclicksolution.online/company`.
* A module's "sign in again" link (`/portal/?next=…`) on a device that has not chosen its company: after the code the Portal's
  dashboard opens, not that module directly (the first time on that device only).

## Order of the merge
1. This pull request (Mechanical) – the page exists, nothing sends anybody to it yet.
2. Then the Portal's `company-gate` – from then a device without a company sees the first page.

## Going back
The Portal: Vercel → Instant Rollback (the sign-in opens as before). Mechanical: Instant Rollback to update-231.
