# update-110 – The language of the app: Marathi / Hindi / English, each user his own (14-10-2026)

**Asked:** "app madhe app language cha option haway marathi hindi english ji language select asel app tyach language madhe sagle
kahi dakhwel mg kam aso ki errors aso suggestions aso app language ji set asel tya paramane te asel he user vise asel".
His choice: everything at once ("एकदम सगळे").

## How it works
* **Settings → "Language of the app"**: मराठी / हिंदी / English (replaces "Language of the help"). Kept with the user's account
  (`appLang`), so it is the same on every computer. Each user has his own; a new user starts in English (as today).
  The help of the errors follows the same choice.
* Choosing Marathi or Hindi turns the screen at once; going back to English (or to the other language) draws the page again.
* The sign-in page shows the language of the last user of that computer.
* **What is turned:** everything shown – the menu, page names, headings, buttons, boxes' hints, tooltips, messages, the server's
  errors and their help, the assistant's screen texts. Written in Devanagari: common work words are written in Devanagari
  letters (सेव्ह, एन्ट्री, मशिनरी, लॉग बुक, डिझेल …). Kept in English letters: GST, TDS, KM, BOQ, PDF, Excel, WhatsApp, company /
  vendor / site names, machinery numbers, file names.
* **Not touched:**
  * what is typed or saved – entries keep their English values (a drop-down shows दिवस / रात्र but saves "Day" / "Night");
  * the papers that go out: RA Bill / Abstract, Tax Invoice, Debit / Credit Notes, Log Book sheets, prints, Excel files – English
    as before;
  * names and data from the database (machinery, vendors, work names typed by people).
* A text that has no translation stays English.

## How it is built
* The page's code stays English. A small part of the page (`I18N`, in `app/App.html` after `const S`) turns each text as it
  appears on the screen, from `app/i18n/mr.json` and `app/i18n/hi.json` (English → the language; ~5,950 texts each; a text with
  {0} is a pattern whose parts are filled by the page). The file is fetched once per version and kept in the browser.
* `tools/i18n/extract.js` collects every text of the page and the server into `app/i18n/keys.json` (7,197 texts). After new texts
  are added, run it again and translate the new ones.
* Code that looked at a button's or a drop-down's words now works in any language (`busy()`, the bill-name drop-downs, the folds,
  the Log Book row tag). A box of the browser itself (alert / confirm) is turned too.
* Served: `build.js` copies the two files to `/i18n/`, `dev.js` serves them locally, `vercel.json` sets no-cache.
* Server: `appLang` added to the user's settings (`PREF_PICK_`: '', mr, hi). No SQL step.

## Built on update-109 (pull request #21) – merge that one first
While testing this, two things of update-109 were found and fixed there (pull request #21 has them):
* Log Book "one machinery – many dates": the FIRST row took the shift after the one of the time (Day by the clock → the row
  said Night). Fixed.
* Old page tests that counted on a new row being "Full Day" set it themselves now.

## Evidence (local rig, test data only)
* Unit: 75 / 75 – new "update-110": every translation keeps its {0}… and is a real text of the app; exact texts, patterns, an
  English ending left out, words after it carried over, numbers untouched, the memory of worked-out texts; the papers / typing
  boxes / drop-down values left alone; busy(); the Settings switch and the server's check; served by build / dev / Vercel; every
  script block of the page parses.
* Browser `test/browser/lang110.js` → 17 / 17: English at start; Settings shows the switch; Marathi at once (menu, Settings,
  Diesel Issue headings and hints); kept with the account (and the help); the shift drop-down shows दिवस / रात्र and keeps "Day" /
  "Night"; the assistant's box hint; a page message and a server error with its help in Marathi; a busy button gets its words back;
  **all 39 pages opened in Marathi with every heading Marathi and no page error**; another window opens in Marathi; Hindi; English
  again.
* Saving in Marathi (rig): entry71 (Log Book rows, several works in a shift) and tanker107 (Excel import with a water tanker) ran
  with the user in Marathi – the entries were saved the same; their only failures were the tests' own English-word checks.
* Old browser tests in English: idle 10, entry71 20, settings 10 (changed: it presses the new switch), shift109 8, tanker107 8,
  billlock 16, debit 5, dnui 8, viewbill 23, half 12, gap77 20, item2 13, meter 8, start 8, time76 10.
  set2.js (the photo) fails 1 the same on the update-109 code (not caused by this).
* Speed: a list of 2,000 rows × 6 cells is turned in about 0.1–0.15 s (drawing it takes about 0.25 s); a normal page about
  0.05–0.08 s. Switching to Marathi the first time: about 0.4 s.
* `node --check` on server/*.js, api/*.js, build.js, dev.js; the page's script blocks parse (also in the unit test).

## Not verified
* Not tried on the live site or a real phone browser. The translations were made by me (AI) and checked for the {0} parts and
  for English left in them – a person from the site should read the screens once and tell what to word differently.
* The help texts of the errors are the existing Marathi / Hindi ones (they mix some English words such as "save", "Admin").
* The Read Me page (the technical set-up guide) stays English. Month names (Aug 2026) stay English.
* Not part of this: the Portal (sign-in, Users & Access), the Store, and the phone app (its screens are English + Marathi as before).

## Going back
Vercel → Instant Rollback to the previous update. Nothing in the database changes (the setting is one more value in the user's
settings; the older code ignores it).
