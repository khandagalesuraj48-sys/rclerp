# update-209 – two motions of the web: the menu behind the page (push back) and the message as a gooey drop (03-11-2026)

**Asked:** "app madhe aplela tab bar cha ui change kraycha … ripple fill … fill the tapped tab from its centre the old faded ok ani menu web
plus app madhe push back use kraych aahe the page shrink back and side right revealing the menu behind it ok ata notification gooey drop
madhe a gooey drop falls from the top then melts and spread into a toast". His answers: the gooey drop **web + app**; the push back on the
web **only on a phone / tablet**; **a preview first** – the preview (claude.ai artifact "RCL ERP Motion Preview") OK'd ("ok"). The app
menu's colour: he chose nothing, so it stays as it is (light). The tab bar's ripple fill is the app's only (the web has no tab bar).

**No database step. No new setting.** With rcl-mobile 3.83.0.

## What changes
* **Push back menu – the web on a phone / tablet (≤ 760 px, where the menu came over the page):** ☰ makes the page (its bar and all)
  shrink back and move to the right; the menu is **behind** it on the left. A tap on the page, Back, a swipe to the left or a page of the
  menu closes it. While open the page does not scroll, and the assistant's button is hidden. **A computer: the menu stays open on the left,
  as before.**
* **Gooey drop message (every message of the web – `toast()`):** the message is now **at the top**: a drop falls (stretched, squashed when it
  lands), melts and spreads into the message – two beads run to its ends – and the words and the ✓ / ! come in; at the end it gathers back
  into a drop that goes up. **Colours and times as before** (dark / red; 3.5 s, a red one 6 s). The message's text is the same
  (`$('toast').textContent`). "Reduce motion" or no browser animations: the message as it is.
* **Where:** `app/App.html` – the CSS block "update-209 … TWO MOTIONS" (end of the stylesheet); `setDrawer` (the clip, the middle, the scroll
  lock); a `resize` closes it on a wide screen; `toast()` (the words in `.tx`, the drop `.goo`), `gooEl`, `gooRun`; the SVG filter `#rcl_goo`.

## Evidence
* Unit: `timeout 300 node --test test/unit.test.js` – 162 / 162 (new `update-209`; `update-125` now reads the longer `setDrawer`). The page's
  script blocks parse.
* The rig in Chromium (test values only), a phone (Pixel 7) – 10 / 10: closed – the menu not there, the page as before; ☰ – the page moved
  right and smaller, clipped with round corners, not scrolling, the tap area on it; a page of the menu (Log Book) – closed, the page back,
  scrolls again; a tap on the page closes; the message at the top with its text as before, the colour spread to its size, gone after 3.5 s;
  a red 5-line (Marathi) one spreads to its size; no page error. A computer: the menu open on the left as before. Pictures looked at
  (the drop falling, spreading, the message, going up; the menu behind).

## Not verified
* Not run on the live site; not on a real phone's browser or an iPhone (Safari).

## Going back
Vercel → Instant Rollback to the update before.
