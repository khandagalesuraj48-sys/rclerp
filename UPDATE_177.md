# update-177 – the old log book: no limit of the file's size; a PDF of any number of pages (28-10-2026)

**Asked (28-10-2026, 09:32, after update-176):** "are bhai pdf size cha issue yeu naye ani eka pdf madhe multiple pages pn ashu shaktat".

**No database step. Nothing saved is changed. No secret in any file.**

## What changes (page Maintenance → Import the old log book)
* **No limit of the file's size** (it was 3 MB): a PDF of any size and **any number of pages** – it is taken apart on the page and one
  page at a time goes to the AI (update-176), page 1 of N … N of N. A page alone may be up to 3 MB (a normal page is a few KB; only a
  scan of very high quality is more – then it says which page and what to do).
* **A photo of a page bigger than 3 MB is made smaller on the page** (a JPEG, its long side 2,600 px – the rows stay readable; smaller
  again if needed) and then read.
* Only a PDF that cannot be taken apart (a damaged file) goes whole – then it must be 3 MB or less, and it says so ("save it again as a
  PDF").
* The words in English, मराठी and हिंदी.

## Evidence
* `timeout 300 node --test test/unit.test.js` → **130 / 130 pass** (new `update-177`: no check of the whole file's size; a page alone up
  to 3 MB; a bigger photo made smaller; the PDF taken apart before anything is read whole).
* `node --check` on `server/*.js` and `api/*.js`; the page's script blocks parse; acorn: one `.test` fewer on the page – on purpose (a PDF is known by its type, no more by its data); no secret in the change.
* **The local rig** (Claude stand-in): `mnt173.js` **24 / 24** – new part 7: a PDF of 4.4 MB (2 pages) read, each page sent alone
  (under 100 KB); a photo of 21.7 MB made smaller on the page (a JPEG of 3 MB or less) and read; `mnt170.js` **21 / 21**.
* **Not verified:** his real files; the real Claude service.
* **The phone app 3.53.0** sends the whole file, so there the 3 MB limit stays until its next version (it will take the pages apart too).

## Going back
* Vercel → Instant Rollback to update-176.
