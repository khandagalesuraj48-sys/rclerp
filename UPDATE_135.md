# update-135 – Screen share as in Google Meet; the laptop's own camera first; the bar can be hidden (19-10-2026)

**Asked (with a picture of a call: two big bars, one inside the shared screen):** "screen share kel nantr he as distey yar he fix kr
proper google meet war kas aste tas kr n ani ha show my camera kel ki new app open krtey tr high priority ki laptop cha camera use krel
jr laptop la camre nasel tewa externel app la prefere karel ani khali je connect zale nantr je yet te hide karta haw proper".

## What changes (the page only – the calls themselves work as before)
* **The bar of a call, as in Google Meet:** dark, round buttons in the middle with their word under them – **Mute · Show my camera ·
  Show my screen · Chat · More · End/Leave** (red) – who and the time on the left, **Hide** on the right. The camera is now in the bar
  itself (it was under More). Muted = red; my screen or camera shown = blue.
* **Hide:** the bar becomes a small pill at the bottom right – the time, the microphone (and Stop while my screen or camera is
  shown) and ▲ to show the bar again. The picture of the other's screen then uses the whole window.
* **While I show my screen, my bar hides itself** (it was in the picture the others see – the picture he sent): the pill with
  **Stop**; when I stop, the bar comes back by itself.
* **The screen shown to me is big** (as in Meet – almost the whole window, above the bar); **Size** still makes it middle / small.
* **Show my camera on a computer: its own camera first** – the laptop's built-in camera, then another real camera; a camera app
  (a phone used as a camera, a "virtual camera" that opens its own app) only when there is no other. Until now the "back camera"
  was asked – a laptop's camera is a front camera, so the browser took the camera app. Now the front camera is asked; once the
  camera was allowed the browser gives the names and the best one is taken by its name; if a camera app opened the first time,
  it is changed for the computer's own camera at once. **Switch camera** (More) goes to the computer's next camera. A phone: as
  before (the back camera first).
* The assistant's button stays above the bar; on a phone the bar fits the screen.

## Evidence
* **Rig browser test** `test/browser/call135.js` **9 / 9** (two real browsers, a pretend camera and microphone): A calls B (his screen
  shown) → A's bar is the pill [Mute, Stop showing my screen, Show the bar]; B accepts → A's screen at 99 % × 87 % of the window, B's
  bar Mute · Show my camera · Show my screen · Chat · More · Leave · Hide; Hide → the pill, the picture grows; back; a 390 px window:
  the bar fits; B's camera → A sees "Camera of B 135 Bala"; A's Stop on the pill → his bar back; the camera order of a computer
  (Integrated Webcam → Logitech → OBS Virtual Camera → Phone Link camera) and the first time without names (the front camera
  asked, the camera app changed for the integrated one; only a camera app → it is used). Pictures: `test/shots/call135_*.png`.
* **Unit tests 95 / 95.** `node --check` on `server/*.js`, `api/*.js`; the page's script blocks parse; no secret in the change.

## Not verified
* A real laptop with a camera app (Phone Link, Camo, OBS …): the names of cameras differ by maker – the order is by name (a camera
  app is known by words such as "virtual", "OBS", "Camo", "DroidCam", "Iriun", "Phone Link"; a laptop's own by "Integrated",
  "Built-in", "FaceTime", "TrueVision", "HD UVC" …). If his camera app has another name, tell the name and it is added.
* The older screen-share tests (`screen72.js`, `group72.js`, `media75.js`, `master75.js`, `relay73.js`, `push75.js`) were not run:
  they make their users with Users & Access, which is refused once the site has its Super Admin ("Users and access are given by the
  Super Admin only"); `call135.js` makes its users in the rig's database instead.

## Going back
Vercel → Instant Rollback to update-134. Nothing is saved differently.
