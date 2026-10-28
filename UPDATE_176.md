# update-176 – the old log book's PDF read a page at a time: only that page goes to the AI (28-10-2026)

**Asked (28-10-2026, 09:13, with his picture):** "ha problem solve kr" – Maintenance → Import the old log book → a PDF: "Reading with the
AI… page 1", then "The AI could not read the log book now (the AI service was too slow to answer) – try again in a minute."

**No database step. Nothing saved is changed. No secret in any file.**

## Why it happened
* Every call sent the **whole PDF** to the AI (Claude), and asked it to read only page 1–2 (then page 1). Claude works through **every
  page** of a PDF it is given – a log book of many pages took longer than the 50 seconds the server gives one AI question, at every call.

## What changes
* **Only the page being read goes to the AI** – a PDF of that one page, taken out of the file:
  * on the page (web): the page is taken out in the browser (pdf-lib 1.17.1 – the app's own file `/vendor/pdf-lib-1.17.1.min.js`), so
    only that page is sent to the server too (smaller, faster on the site's internet);
  * on the server: a PDF that comes whole (the phone app 3.53.0, or a PDF the page could not take apart) – the server takes the page out
    (`readMaintLog_`, the server's helper thread). The number of pages is the file's own.
  * A PDF that cannot be taken apart (a damaged file): sent whole, as before.
* **One page a call.** Too slow (or busy, or the answer cut) once: **the same page is asked again of the quicker model (Haiku)**. The
  phone app's second try (one page) is that same second try. Then the message as before.
* The rest as before: each machinery's table a sheet, the names' list, Check, Import, never twice.

## Evidence
* `timeout 300 node --test test/unit.test.js` → **129 / 129 pass**. New `update-176` test: a real PDF of 5 pages → page 3 alone (the
  file's 5 pages; after the last page nothing; not a PDF – said); the server's reading sends only that page, not kept, "page 3 of the 5
  pages"; after the last page nothing is asked; "fast" – Haiku first; the phone app's second try – Haiku; its first try – Sonnet, one
  page; a PDF that cannot be taken apart – whole, as before; the page takes the page out and asks again "fast"; the PDF tool is the
  published file (SHA-256), it goes with the server (`vercel.json` `includeFiles: app/**`).
* `node --check` on `server/*.js` and `api/*.js`; the page's script blocks parse; acorn: the page's calls 208 → 207 (the two
  `readMaintLog` calls of the loop are one now – on purpose); no secret in the change.
* **The local rig** (Claude stand-in): `mnt173.js` **22 / 22** – part 3 now with a real PDF of 3 pages: 4 questions, each one page alone
  (not kept): page 1, page 2 cut off and asked again of Haiku, page 3; the same two machinery and bills as before; `mnt170.js` **21 / 21**.
* **Not verified:** the real Claude service's time on his real PDF (the rig's stand-in answers at once); the phone app (it uses the same
  server – its own PDF is sent whole and the server takes the page out); a scanned PDF of very many rows on one page.

## Going back
* Vercel → Instant Rollback to update-175 (the whole PDF sent at every call).
