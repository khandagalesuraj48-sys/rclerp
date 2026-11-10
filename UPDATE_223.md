# update-223 – Smooth: the menu, the Log Book view and the modules loading in the background (no SQL) (10-11-2026)

**Asked (10-11-2026):** "web app madhn modual or submenu madhe shift hotana screen atkte hang zale sarke watat ekdam smooth ani speed watat
nahi tab changes madhe menu submenu madhe". (Built on update-222 – the logo.)

## What was measured (local test copy, Chromium with the processor slowed 4× – a laptop on battery; 3 rounds each)
| | before (main + update-222) | this update |
|---|---|---|
| open the pages menu – frames slower than 50 ms / lost time | 8 / 916 ms | **2 / 284–383 ms** |
| Dashboard → its Log Book view – the longest frame / lost time | 1,067 ms / 3,183 ms | **500 ms / 2,016 ms** |
| a module's page → another module's page | – | 0 slow frames (already smooth) |
| with every animation switched off ("Less motion") | about the same | – the animations are not what costs |
The cost was the page's own work: (1) the menu's WIDTH slid, so the whole page laid itself out again on every frame of the slide;
(2) the Log Book view drew all its pending cards in one go and worked out each date's age about 100,000 times (the test copy has the
worst case – 19,543 pending machinery-days).

## What changes (App.html – the look and the order of drawing only)
1. **The pages menu on a computer:** the page adjusts **once** (opening: at once; closing: when the slide-out has ended); only the menu's
   content slides and fades (transform / opacity – the graphics card). The phone's sheet already only moved.
2. **His modules loading in the background (update-221):** started 5 s after the screen has its data (was 2.5 s), each only when nobody
   touched the screen for 2 s (or after 20 s at the latest) and the browser is idle, 4 s apart – a module's page loads on the same
   processor, so never in the middle of his clicks.
3. **The Log Book view's pending list:** the first 30 cards at once, the rest 60 a frame (the same cards, the same order; a newer list
   stops the drawing of the old one); each date's age worked out once; a card out of sight is not laid out or drawn until it is scrolled
   to (`content-visibility`).

## Evidence
* Unit tests 175 / 175 (new `update-223`; `update-221` brought up to date: 5 s / 4 s).
* Rig browser tests: `motion221.js` 9 / 9 (the modules still ready in the background, no "Signing in…"), `nav219.js` 14 / 14; the
  Log Book view: the same badges, 276 cards, the same chips and first card as main; the page opened again on that view shows its list.

## Not verified
* The live site and his computer (the numbers above are the test copy with a slowed processor). The live Log Book list is shorter
  (fewer pending days), so its gain there is smaller.

## Going back
Vercel → Instant Rollback. No database step.
