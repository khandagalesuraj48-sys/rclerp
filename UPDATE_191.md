# update-191 – 🎙 Speak into a box: words and numbers in मराठी / हिंदी / English (29-10-2026)

**Asked (29-10-2026, 13:39):** "jithe jithe type krun entry hotat ata prynt app madhe kuth hi ani new kahi yenar asel jyat type krun
entry krne aahe tithe voice mick banaw user apla voice madhe bolel AI samjle user kay boltoy perfect samjel ani text madhe add krel ok
hindi english marathi ya sagle language support astil". His answers: **the app and the website**; **words and numbers**.

**No SQL.** No data is changed. No server code is changed.

## What changes
* `app/App.html`: the block **SPEAK INTO A BOX** before `</body>` (the same code as the Store's / Engineering's `public/voice.js` and
  the Portal's block – one code in every module):
  * a box where an entry is typed (text, number, phone, a note), when it is in use, shows a 🎙 at its right end – every page, and every
    box added later, by itself;
  * pressed, the browser's own speech recognition (Chrome / Edge – the same one the assistant's 🎙 uses, from the top window) listens in
    **मराठी / हिंदी / English** – chips while it listens; the one chosen is kept in this browser; at first the help language (Settings);
  * what was said goes in **as if typed** (`input` and `change` – the page reacts as for typing): a number box gets the **number** –
    "साडे तीन हजार" → 3500, "बारा पॉइंट पाच" → 12.5, "डेढ़ सौ" → 150, "twenty five" → 25, "1 lakh 20 thousand" → 120000; a phone box
    the digits said; a text box the words at the cursor;
  * never in a password box, a date, a box only shown, or under `data-novoice` – the assistant's own box (`#ai_form`) has its 🎙 already;
  * a browser that cannot listen (Firefox): no 🎙 – the boxes as before; the microphone not allowed: how to allow it, in his language.
* A module's page inside this screen (the Store at /store/, Engineering at /engineering/ – the same address) listens the same way.
* With: rcl-store PR #24, rcl-engineering PR #8, rcl-portal PR #28 (their `vercel.json` now let their own pages use the microphone,
  as this one's does), the phone app 3.67.0 (its own 🎙 over every box).

## Evidence
* Unit tests: **144 / 144** (`update-191`: the block in the page, 63 number cases, the assistant's box left out, the language, the
  site's microphone rule).
* `test/voice.browser.test.js` **21 / 21**, three runs (a stand-in for the browser's listening in the rig's Chromium: the 🎙 in a box in
  use and not in a password / date / shown-only / data-novoice box; words at the cursor; numbers; digits; input + change; the chips; the
  microphone not allowed; a phone's width).
* The rig's browser tests with this page and with main, the same set (entry71, lists, master75, comp190, cards164, mnt165, fuel163,
  att153, inframe100, lang110, dates, ai): **the same results on both** – passed / failed: entry71 20/0, lists 7/2, master75 7/6,
  comp190 12/0, cards164 0/2, mnt165 0/4, fuel163 0/2, att153 5/7, inframe100 1/1, lang110 17/0, ai 13/0 – on this branch and on main
  alike (the ones that fail, fail on main too: the rig's mode – no Portal, no one-address gateway – and its dated story).
* `node --check` on `server/*.js`, `api/*.js`; the page's scripts parse; no secret in the change.

## Not verified
* A real microphone and Google's recognition (a test cannot speak); how well Marathi is heard is the browser's.
* The live site.

## Going back
Vercel → Instant Rollback to the previous update.
