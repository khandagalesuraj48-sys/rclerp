# update-221 – Motion (his animation brief) + the menu polished + his modules ready in the background (no SQL) (10-11-2026)

**Asked (10-11-2026):** the brief "MY RACHANA ERP – Complete Enterprise UI Animation & Micro-Interaction Upgrade" (visual only, never a fake
loading or success, nothing delayed, reduced motion respected; audit first – Project doc `architecture/RCL_ERP_Animation_Audit.md`), and
after update-219 went live: "jya modual war click krel to colour tith jail … rachana name khup small zal te proper disaw … weg wegle
submenu scroll tab war click nantr modual click madhe animations ahwet zoom in out che … machinery madhun store war click kel ki sign in he
as yeteyhe alech nahi pahije … user erp chalu kel ki auto sign in houn jatil jyala je access ahe tech … speed pn haway ani proper pn haway".
This is the Mechanical part (App.html only). Store, Engineering, Purchase, the Portal and the phone app follow in their own updates.

## What changes (App.html – the look only; every call, check, access and answer as before)
1. **Question / Delete boxes (`askConfirm`, 149 places): Scale Pop** – in from 72 % with a small overshoot (0.26 s); the Delete button red and
   lifted. **A refused / warning box** ("Nothing saved", a stock alert): a short controlled **wobble**.
2. **Every small box closes with a fade and scale-down** (the question box, the ownership pop-up, the password, Edit Log Book, Ctrl + K).
   The box itself is closed and answered **at once, exactly as before**; only a picture of it (not usable, not read aloud, after it in the
   page) fades out in 0.16 s and is taken away; opened again meanwhile, the picture goes at once.
3. **A button whose work waits for the server (`busy`, 134 places)**: a small turning ring **exactly while it waits**; a refusal: a short
   shake (not for "sent for approval / verification", which is no refusal). No ✓ is added – the existing message says what happened.
4. **Zoom in / out** (his words): a page's parts zoom in when it opens (from 96.5 %, was a rise), also a part that appears as it is scrolled
   to; the Dashboard's Diesel / Log Book tab zooms in; a module's page (Store, Engineering, Purchase …) zooms in when it is shown; the
   pages panel zooms in as it opens and out as it closes; another module's pages zoom in when switched; a rail button is pressed in.
5. **The yellow follows the click:** while a module's pages are open, THAT module is yellow; the module of the open page keeps a thin
   yellow line. Picked a page: its module is yellow, as before.
6. **The Rachana logo in full** at the top of the pages panel (a computer), with "Fleet ERP by One Click Solution" – as the old menu had it.
7. **Proper module names:** "engineering / purchase" from the Portal's list are shown "Engineering / Purchase" (rail, panel, titles).
8. **His modules are ready in the background – no "Signing in…":** 2.5 s after this screen has its data, the page of each of his other
   modules of this site (the Portal's list – only those he has access to; only those of this address) is loaded out of sight, one after the
   other (1.5 s apart), and signs in by itself exactly as it does when opened (its own ticket from the Portal). A click then shows it at
   once. Not on a connection that asks to save data; a module already loaded is not loaded again.

**Off with reduced motion:** the system's "reduce motion" and My settings → "Less motion" stop every new animation (and the closing picture).
Only `transform` / `opacity` move. Print pages, the bill prints, the screen lock, the live redraws, scanning – not touched.

## Evidence (local test copy, test data only – nothing saved)
* Unit tests: 174 / 174 (new `update-221`: the keyframes move only transform / opacity; Scale Pop / Wobble; the box closed and answered at
  once as before; the picture not usable, gone on reopening, not with reduced motion / Less motion; busy's ring taken away on either answer,
  no shake for "sent"; the zoom rules; the yellow; the logo; the names (`modName`: engineering → Engineering, "HO Store" kept); the
  background loading rules; reduced motion).
* Rig browser test `test/browser/motion221.js` **9 / 9**: the Delete box pops (`moPop`), a refused one wobbles (`moWobble`); closing →
  closed and answered at once, one picture, not usable, gone in < 0.45 s, none when opened again; the ring only while waiting, words back,
  a refusal shakes, "sent for approval" does not; Less motion → no picture; a page and the Log Book tab zoom in; **through the Portal at one
  address: Engineering and Purchase ready in the background 6 s after opening (out of sight), the clicked module yellow, Machinery a thin
  line, the names proper, the logo on the pages, the module's page shown in 25 ms – signed in already, no "Signing in…" – zooming in**;
  no error on the page.
* `nav219.js` 14 / 14 (the menu as before). Page speed, sign in → Dashboard filled (3 runs): 0.92–0.96 s (update-220: 1.10–1.28 s) – no
  slower.
* Pictures: the Delete box, a module's pages (yellow, logo), a module's page – with the pull request.

## Not verified
* The live site, a real phone / iPhone, Safari / Firefox (Chromium only on the test copy).
* On the live site the extra load of loading his modules in the background: each module's page signs in and loads its first page once per
  opening of Mechanical (as it already did once he opened it); its own refresh then runs while Mechanical is open.

## Going back
Vercel → Instant Rollback to update-219/220. No database step.
