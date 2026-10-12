# update-87 – Diesel Issue on the phone: location opens at once, the litres and the driver filled, the AI reads the right reading (12-10-2026)

Asked by the owner on 12-10-2026 (with update-86 in his hands): the location is on, still "Finding your location…" takes time –
it must be quick (the app is installed on the phone); the Driver Name should come by itself – the one used for the last entry; the
dispenser photo shows the quantity – Diesel Qty must fill itself like the reading; the AI takes time and is sometimes confused when a
dashboard shows several numbers – check the last entry's KM first so it knows which number to put. "Give me the best solution and
fix it."

No database step, nothing to set in Vercel. Live: update-86 (`6bbe390`).

## What changes
| Where | What |
|---|---|
| Opening the app | Location ALLOWED already → the app opens at once and the place is found behind it (no "Finding your location…" screen, however slow the GPS). Only a "no" (location off / not allowed) brings the screen. Not allowed yet → the screen while the browser asks, as before. |
| Driver Name (One entry) | the driver of the machinery's last fill comes by itself – only into an empty box or one filled this way before; a name typed by the person is never changed; not when editing an entry. |
| Dispenser litres photo | the AI reads the litres on the display → Diesel Qty (blue, as the reading). It is also asked for the amount (₹) and the rate: litres not read → amount ÷ rate; litres × rate more than 3 % from the amount → "Check" (yellow). |
| Dashboard photo – the right number | the AI is told the machinery's last reading (its last diesel fill with a reading, or its last Log Book Close – the newer, with the date) and asked for the meter AND every other number it sees. The app then takes: its reading if it is not below the last and not more than the machinery can run since (KM 800 a day / at least 300; Hrs 24 a day / at least 30); else the same number with the decimal point moved (a tenth digit in another colour: 45173 → 4517.3); else another number it saw that fits (the nearest above the last); else its reading with "Check: reading less than / much more than the last reading N (date)". |
| Faster | the AI gets a smaller copy (1280 px) and is asked AT ONCE – while the photo is being sent (before: after it was kept). A slow AI never holds up the photo or the Save. |
| The note under the reading | one line: "AI read on the photos: 4,517.3 hr · 45 L – check with the photos …", "Check: …" (yellow) and "The AI is reading the meter / the litres…" while it works. Typing over a value the AI put: the typed value stays and nothing more is said about it. |
| Help (EN / MR / HI) | Diesel Issue page. |

Server: `meterReading_` (kind dash | pump), `aiAskPhoto_`, `aiJson_`, `aiNum_`, `lastKnownReading_`, `pickReading_`, `aiReadMeter_`,
`aiReadPump_`, `pumpAnswer_` (`app/Code.gs`). Page: `locCheck`, `phAsk`, `phApplyRead`, `phMake` (the smaller copy), `dhDriver`
(`app/App.html`).

## Evidence (local rig – AI stand-in; every command with a time limit, none reached it)
| Test | Result |
|---|---|
| `photo85.js` (phone, extended): Driver box = "P85 driver" (the last fill's); the AI got a smaller copy (JPG, < the kept picture) and the question names the last reading ("the hour meter showed 4500 hours on …") and asks for every number; Hrs 4517.3 filled; typed 4517.5 stays, nothing more said; dispenser photo → Diesel Qty 45 (blue, in the note); the AI asked for the dashboard and the dispenser only; location allowed + GPS answering 3 s late → app open at once, the place comes after; + everything of update-85 | 35 passed, 0 failed |
| unit (1 new test): last 4500 h on 05-10, today 12-10 → 4517.3 taken; 45173 → 4517.3; the clock 1245 with 4512.6 among the numbers → 4512.6; 4100 → "less than the last reading 4500 (05-10-2026)"; 9000 the next day → "much more"; KM 45,000 → 45,320 next day taken; no last reading → as read; pump 45 L / ₹4140 / ₹92 → 45; no litres → 4140 ÷ 92 = 45; 4140 L → check; "45.50" → 45.5; the page fills Diesel Qty from the pump and the driver only into an empty / auto box | 58 / 58 |
| photo85api 25 / 0 · mobile86 18 / 0 · sweep 38 · entry71 20 · access84 18 · hardenpage 10 · least68 9 | all 0 failed |

## Not verified / said plainly
* How well the real AI reads real dashboards and dispensers (the rig's stand-in answers what the test sets). The rules above make
  a wrong number visible ("Check") instead of silently taking it; a meter that was replaced (new meter, lower reading) will show
  "Check" until a new reading is saved.
* Real phones (a phone-sized browser with touch was used).

## Going back
Vercel → Instant Rollback → update-86 (`6bbe390`). Nothing in the database to undo.

## To deploy (owner; no SQL)
```
cd "C:\Users\aghug\Desktop\WEBSITE AND APP\rcl-fleet-erp"
git status
Expand-Archive -Path "$HOME\Downloads\rcl-update-87.zip" -DestinationPath . -Force
git status
git add .
git commit -m "update-87: phone - location opens at once, litres and driver filled, AI reading checked against the last reading"
git push
```
