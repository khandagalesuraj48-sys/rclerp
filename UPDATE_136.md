# update-136 – Screen share: the screen AND the camera at the same time; the faces at the side; the best picture and voice (19-10-2026)

**Asked:** "show my camera kela ki screen band hote screen kel ki camrea band hot as nko aahe screen share chalu astana user ne jar camera
share kela tr poper mala maza pn face disel ani user ch aapn perfect he haw aahe quality pn super yeyla hawi voice pn clear yawa ekdam
perfect asaw sagle logic use kr user kahi hi kru shakto sagle kahi perfect hoyla haw".

## What changes (the page only)
* **The screen and the camera are each on their own:** Show my camera does not stop the screen, Show my screen does not stop the
  camera; each Stop stops only its own. Until now one picture per person (the second stopped the first).
* **The faces, as in Google Meet:** every camera of a face (a computer's own camera, a phone's front camera) is a small picture at
  the right side with the name – the others' and **my own ("You", as in a mirror)**; on a phone the faces are a row on top. The
  big picture is a **screen** (and leaves the faces room); a **tap on a face shows it big** – its tab (or a new screen) brings the
  screen back. A phone's back camera (showing a machine, a meter, a paper – update-75) is shown big, as a screen is; when the phone
  turns to its front camera it becomes a face.
* While I show my screen nothing big covers my own app – the others' faces are at the side.
* **Quality:** the screen up to Full HD, sharp (up to 2.5 Mbit/s – the size is kept, the speed gives way), the camera smooth
  (24 a second, up to 1.2 Mbit/s), the voice first (high priority, up to 64 kbit/s; marked as speech, echo cancelling, noise removal,
  level, one channel at 48 kHz). Low data (by itself on a weak line, or More → Low data) as before; the voice is never cut.
* The bar says "Your screen and camera are shown" / "Your camera is shown" …; the camera button is blue while it is on.

## Evidence
* **Rig browser test** `test/browser/both136.js` **12 / 12** (two real browsers, a pretend camera and microphone): A calls B with his
  screen; A shows his camera too → both on ("Your screen and camera are shown"), A sees "You", B sees A's screen big and A's face at the
  side; B shows his camera → A sees [B, You] with nothing big over his own app, B sees [A, You] and A's screen still big, the big picture
  leaves the faces room; a phone-sized window: the faces a row on top, the big picture under them; what A sends: screen 2.5 Mbit/s
  "maintain-resolution", camera 1.2 Mbit/s 24/s, voice 64 kbit/s priority high; B taps A's face → big, the screen a tab → back; A
  stops his camera → the screen goes on; shows it again and stops the screen → the camera goes on; the voices both ways all along;
  the end clears the faces. Pictures `test/shots/both136_*.png`.
* `call135.js` **9 / 9** again (its camera step now sees a face at the side).
* **Unit tests 95 / 95.** `node --check` on `server/*.js`, `api/*.js`; the page's script blocks parse; no secret in the change.

## Not verified
* Real cameras and microphones, a real weak line, three people in a call (the host passes on every picture – the code for it is the
  same as before), Safari / iPhone.
* A page opened before this update (until it is reloaded) still sends one picture at a time; it sees the faces of the others big as
  before.

## Going back
Vercel → Instant Rollback to update-135. Nothing is saved differently.
