# update-210 – the app's own page `<main address>/app` – what the phone app's "Share app" sends (04-11-2026)

**Asked:** "app madhech share application asa option de user jewa he dabel to other la whats app aso ki link madhe to share ku shakel
dusryala latest version app che user dusrya la deu shakel nantr dusra login krel". His answers: the option in the app's ≡ menu; the link
opens **a download page at our own address**.

**No database step. No setting.** With rcl-mobile 3.84.0 (≡ → Share app).

## What changes
* **`https://oneclicksolution-erp.vercel.app/app`** – a page of its own (not the ERP): the app's icon, **"App download करा (Android)"**
  with the latest version and its size, a smaller file for most new phones (64-bit) under it, the **3 steps** (download · install – allow
  this source if the phone asks · open RCL ERP and sign in with the email and password the Admin gave), मराठी / English / हिंदी. An
  iPhone is told the app is not there yet (the web in Safari). A WhatsApp link shows its name and the app's icon.
* **Always the latest version:** the page reads the newest **stable** GitHub Release of rcl-mobile (the same files the app updates itself
  from; a beta one is a pre-release – never offered here) and offers only our files (`rcl-erp-<v>-<b>.apk`, `…arm64-v8a.apk` from our
  releases). GitHub not reachable: it says so and the button opens the releases page.
* Nothing is signed in on the page and nothing about the person who shared is in it.
* **Where:** `app/download.html` (the page; built to `public/app.html` – `build.js`), `vercel.json` (`/app` → `/app.html`, `/app/` → `/app`,
  no-cache), `dev.js` (the rig), `app/icons/rcl-app-192.png` / `rcl-app-512.png` (the phone app's own icon).

## Evidence
* Unit: `timeout 300 node --test test/unit.test.js` – 163 / 163 (new `update-210`: the routes, every word in 3 languages, the pick run on the
  real release's list – our files only, a file from elsewhere never; `update-99` now leaves `/app` to it).
* The rig in Chromium (GitHub's answer stood in by a copy of release v3.83.0-174's list), 8 / 8: Android – "नवीन version 3.83.0 · 100 MB",
  the button = the file for every phone, the 64-bit one under it; English, हिंदी; nothing wider than the phone; no page error; iPhone told;
  GitHub not reachable – said, the button opens the releases page. Pictures looked at.

## Not verified
* Not on the live site; not a real download and install on a phone from the page; the WhatsApp preview not seen (it is read by WhatsApp's
  server from the live page).

## Going back
Vercel → Instant Rollback to the update before.
