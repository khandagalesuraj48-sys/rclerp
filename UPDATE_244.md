# update-244 – The web has its own language: English until the person chooses; a picker on top (14-11-2026)

**Asked:** "web warti language fix english hawey ani user wise jya user ni ji select keli aahe ti web la war ek option de
language selection cha web sathi fkt".

**Why:** the language was one setting for the web and the phone app (`appLang`): a person who chose Marathi in the phone app got
the web in Marathi too.

**No database step. No entry, calculation, bill, ledger, stock or permission changes.**

## What changes
* A new setting of the person, **`webLang`** (kept with his account like the others; '' = English): the web shows English until
  he chooses मराठी or हिंदी. What he chose in the phone app (`appLang`, `lang`) no longer turns the web; the web's choice does
  not turn the phone app (the web never writes `appLang` / `lang` any more).
* **On top of every page** (next to "?"): English / मराठी / हिंदी – the same choice as Settings → "Language of the web" (was
  "Language of the app"). The help of the errors follows it; before any choice it is English (it was Marathi).
* Chosen at one site it is written at the person's other sites (as the app's language is – `sysPrefLang` carries it).
* `app/App.html`, `app/Code.gs` (`PREF_PICK_`, `saveMyPrefs_`, `langSpread_`, `sysPrefLang_`), `app/i18n/*.json` (the two new
  Settings texts in Marathi and Hindi).

## What a person sees after the update
* Everybody's web is English once – also those who had chosen Marathi / Hindi on the web before (that choice was the shared
  one). They choose again on top; it then stays.
* The phone app: nothing changes.

## Evidence
* Unit: 191 / 191 (new `update-244`; `update-110` / `update-112` follow the new lines).
* The page file opens without a script fault (headless browser, not signed in).

## Not verified
* **Not seen signed in, in a browser:** the picker in the top bar (its place and size at narrow widths), the turn to Marathi and
  back from it, the spread to another site. Live.
* HR, the Store, Engineering and Purchase pages have no Marathi / Hindi texts: they stay English whatever is chosen (not part
  of this update).

## Going back
Vercel → Instant Rollback. A saved `webLang` is then ignored (the earlier version drops a setting it does not know).
