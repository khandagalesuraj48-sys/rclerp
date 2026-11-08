# update-201 – voice typing writes the site's own words (02-11-2026)

**Asked:** "jewa mi voice typing krtoy jas ki language English select aahe but te typing je haw tas hot nahi jas ki mi voice bolalo
Arihant City tr apla system tyala Aaryan City tr kadhi Aryna Nagar as karte he kas fix krta yaw". His choice (02-11-2026): **the
site's word list** – the system knows the names already in Log Book / Asset Master / Vendor and the Super Admin's words; it takes
Google's 5 guesses and writes the site's word; a word corrected by hand once is right the next time; free; web + app.

**Why:** the browser's (and the phone's) speech recognition does not know the site's names and writes the nearest word it knows.
Nothing is paid for and no other service is used: the correction is done on the page with the site's own names.

**No database step.** The Super Admin's words and the corrections learned are kept in `app_settings` (`VOICE_WORDS`, `VOICE_FIX`),
as the other settings. No entry, bill, ledger or stock calculation changes.

## What changes
* **Server (`app/Code.gs`)** – three actions (every signed-in person; the list only the Super Admin):
  * `getVoiceWords` – the site's words: Asset Master (name, type, make), Vendor Master, the places and works of the Log Book of the
    last 180 days (Chainage From / To, Work, Remark – split into short phrases; a number like a chainage is never a word), the Super
    Admin's words first; the most used 800; kept 30 minutes. With them the corrections learned.
  * `saveVoiceFix` – a correction made by hand right after speaking ("aryna" → "Arihant"): kept for the site (the last 500; the same
    again counts).
  * `saveVoiceWords` – the Super Admin's words and the list of corrections (one taken off is forgotten). "Only the Super Admin sets
    the site's words for voice typing (signed in through the Portal)." for anybody else.
* **Page (`app/App.html`, SPEAK INTO A BOX)**
  * A text box asks the browser for 5 guesses; the one that fits the site's words best is taken and put right: a word said nearly as
    a site word (sounding alike – the same first sound, 80 % alike, a single word 85 % and at least 5 letters; never a word with
    digits) is written as the site writes it; a word said the same (or its plural) is kept as said; nothing else is touched.
    A note says what was put right ("Site चा शब्द लिहिला – Aaryan City → ARIHANT CITY").
  * What was spoken and then changed by hand (before leaving the box, within 3 minutes) is learned for the site – **only when the
    typed word sounds like what was heard** (the same first sound, 40 % alike): "Aryna" → "Arihant" is learned; "two" → "three",
    "city" → "Nagar", "loading" → "unloading" are a change of what was meant and are not. A site word put in and changed in part
    ("ARIHANT CITY" → "ARIHANT NAGAR") learns what was heard there ("aaryan city" → "ARIHANT NAGAR").
  * Settings (Super Admin only): **Voice typing – the site's own words** – the words (one per line) and the corrections learned
    (Remove), Save.
  * Help (English, Marathi, Hindi) for the new message; the page guide of Settings.
* **Phone app (rcl-mobile 3.74.0, branch `app-3740-voice-words`)** – the same engine (`lib/core/sitewords.dart`, checked against
  the web's own code on the same words: `test/fixtures/voice/web_sitewords.json`), the 🎙 of every text box, the learning, and the
  Super Admin's list on Rules of this site.

## Evidence
* Unit **154 / 154** (new `update-201`: the words from Asset Master, Vendor Master and the Log Book, no chainage; a correction kept
  and counted, nonsense refused; the Super Admin's list only his; the page's engine – "go to Aaryan City" → "go to Arihant City",
  "shifting at Mahalakshmi bridge" → "… Mahalaxmi Bridge", "siddappa bimu basbire" → "Siddhappa Bhimu Basbire", Google's guesses,
  nothing else changed (sale, vada pav, a chainage, a plural, "Aryna Nagar"); a correction learned; where a change stands; the
  sounds-alike rule). `node --check`; the page's script blocks parse.
* The rig in Chromium (a stand-in for the browser's speech gives the guesses): the words reached the page after sign-in; "RCL camp
  to Aaryan City" → "RCL camp to ARIHANT CITY" with the note; changed by hand to "ARIHANT NAGAR" → kept "aaryan city" → "ARIHANT
  NAGAR" (not "city" → "NAGAR"); "Aryna Nagar" written as heard, corrected to "Arihant Nagar" → "aryna" → "Arihant" kept, the next
  "go to Aryna Nagar" → "go to Arihant Nagar"; "two trips" changed to "three trips" → not learned; the panel hidden for an Admin
  who is not the Super Admin; the Super Admin (a Portal ticket): his words through the server's door, the panel with his words and
  the correction, Save (a correction removed), the voice typing has the new list at once; no page fault.
* Found on the way, before this was handed over: the first version learned any change by hand ("two" → "three", "city" →
  "NAGAR") – the sounds-alike rule was added and the rig checked again.

## Not verified
* Real speech (a person speaking into Chrome / a phone) – the rig gives the guesses itself. How well it works depends on what
  Google writes: a name heard very differently ("Aryna Nagar" for "Arihant City") is put right only after it is corrected by hand
  once (or the Super Admin's correction).
* The Store, Purchase and Engineering pages have their own copy of the 🎙 (`voice.js`) – not changed in this update.
* The phone app: its build on GitHub (analyze, tests) – see its pull request; a real phone.

## Going back
Vercel → Instant Rollback to the previous deployment. The words and corrections stay in `app_settings` (unused by the page before).
