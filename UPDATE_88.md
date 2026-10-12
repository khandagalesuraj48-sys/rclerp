# update-88 – the list under a form is a closed bar; pressed, it opens (12-10-2026)

Asked by the owner on 12-10-2026: on Diesel Issue the "Diesel issued" list (and on Diesel Inward "Inward entries", and the same
everywhere) makes the page very long on a phone – the list must stay, but open only when its heading is pressed. His answers:
phone and laptop both; not remembered – when the app is opened again the list is closed, pressed it opens; the list's data must
come quickly; nothing in the lists changes.

No database step, nothing to set in Vercel. Live: update-87 (`a5f8950`).

## What changes
| Page | The list that becomes a bar |
|---|---|
| Diesel Issue | Diesel issued |
| Diesel Inward | Inward entries |
| Diesel Transfer | Transfers |
| Log Book entry | Log Book |
| Tank Check | Tank checks |
| Machinery Payments | Payments & opening balances |
| Breakdown | Saved days |
| Vehicle Compliance | Renewal history |

* The heading of the list is a bar with "▸ Show" on the right; pressed (or Enter / Space), the list opens right under it and the
  bar says "▾ Hide"; pressed again, it closes. Phone and computer.
* The app opened (or opened again): every such list closed. A list opened stays open while the app is open (other pages and back).
* Nothing in the lists changed – they are still read when the page opens (as before), so a list shows at once when it is opened.
* A search result (Ctrl + K) of such a list – a diesel issue, an inward, a transfer, a Log Book entry, a payment, a tank check –
  opens the list too.
* Help (EN / MR / HI): one sentence on each of the 8 pages.

Code: `app/App.html` – `FOLDS`, `foldSetup`, `foldSet`, `foldOpen`; CSS `.panel.fold`, `.fold-head`, `.fold-pill`; the search
openers `gsOpenIssues / Inward / Transfer / Log / Pay / Tank`.

## Evidence (local rig; every command with a time limit, none reached it)
| Test | Result |
|---|---|
| `fold88.js` (new): on a PHONE and on a COMPUTER, for each of the 8 pages – the bar shows the list's name and "Show", the list hidden; pressed → open, "Hide"; Inward pressed again → closed; back to Diesel Issue from another page → still open; its rows there; the app reloaded → closed again; a search result of the list opens it; no script error | 44 passed, 0 failed |
| unit | 58 / 58 |
| The whole browser suite (77 tests, with geo-shim): 0 failed in 61 of them, among them sweep 38, works69 34, entry71 20, gap77 20, viewbill 23, screen72 23, media75 21, machno 19, rate69 19, big 18, mobile86 18, access84 18, billlock 17, xls 14, search83 13, master75 13, item2 13, group72 13 … | |
| The 13 tests that failed (batch, clear, lg2, lists, meter, mob2, new3, pend, rename, set2, splittime, stale, voice) and ai2 / ai3 were run again on the LIVE version (update-86) – they fail there in exactly the same way: they come from the test data left on the rig and from older test expectations, not from this update. `splittime` reads the Log Book list – it now opens the list first, as the person does. | same on live |

## Not verified / said plainly
* Real phones (a phone-sized browser with touch was used).
* Not run: version74, push75, relay73, nightrow, shell85 (they need their own servers / relay); compare69 (another copy's port).

## Going back
Vercel → Instant Rollback → update-87 (`a5f8950`). Nothing in the database to undo.

## To deploy (owner; no SQL)
```
cd "C:\Users\aghug\Desktop\WEBSITE AND APP\rcl-fleet-erp"
git status
Expand-Archive -Path "$HOME\Downloads\rcl-update-88.zip" -DestinationPath . -Force
git status
git add .
git commit -m "update-88: the list under a form is a closed bar - pressed, it opens"
git push
```
