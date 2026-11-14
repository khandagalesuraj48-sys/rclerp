# update-245 – A number spoken into a box: the sentence's full stop no longer spoils it (14-11-2026)

**Asked:** (a picture of the Log Book: "Close" spoken as 1934 – the box stayed empty, "आकडा समजला नाही – काहीच ऐकू आले नाही",
heard: "1934.") "ethe numbers pn yeyla hawet error nko".

**What was wrong:** the browser's speech recognition often ends what it heard like a sentence – "1934." – and a number with a full
stop after it was not read as a number at all (so every plain number spoken this way was refused).

**No database step. No entry, calculation, bill, ledger, stock or permission changes.**

## What changes
* Speak into a box (`app/App.html`, the SPEAK INTO A BOX block): a full stop at the end of a word or number ("1934.", "12.5.",
  "twenty five.") and a ? ! । after it are not part of the number. A point INSIDE a number stays ("1986.5", "12 . 5",
  "twelve point five").
* The same line in every copy: rcl-store, rcl-engineering and rcl-purchase `public/voice.js`, rcl-portal `public/index.html`,
  and the phone app's `lib/core/numwords.dart` (their own pull requests).

## Evidence
* Unit: 191 / 191 – the cases "1934.", "1934. ", "1,934.", "12.5.", "१९३४।", "1934?", "twenty five." are in `update-191`'s list;
  tried by hand as well: 1986.5 → 1986.5, "12 . 5" → 12.5, "five . two" → 5.2, "साडे तीन हजार." → 3500, "1934 hours." → 1934.
* The other modules' unit tests with the same cases: Store 55 / 55, Engineering 34 / 34, Purchase 23 / 23, Portal 36 / 36.

## Not verified
* **Not spoken into a real microphone** – the words the browser hands over were given to the code as text. Live.
* The phone app's change is not built here (GitHub Actions builds and tests it); it reaches people with the next release.

## Going back
Vercel → Instant Rollback.
