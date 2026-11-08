The two Excel tools the page uses (and the PDF tool – update-176), kept here so the app serves them from its own address (/vendor/…) instead of
fetching them from public file servers into the signed-in page (audit of 07-10-2026).

They are the unchanged files of the published packages (taken from the npm registry):

  xlsx-0.18.5.full.min.js   SheetJS Community Edition 0.18.5  –  package "xlsx", file dist/xlsx.full.min.js
                            licence: Apache-2.0      sha256: c9506197caf809a075b6dee1da0d36fb19da7158ffe8a88e7b0c96c5d8623c99
  exceljs-4.4.0.min.js      ExcelJS 4.4.0                     –  package "exceljs", file dist/exceljs.min.js
                            licence: MIT             sha256: 7e49da68588e250dbb8bba190d2caa8ab3787cc0284bda1d8b2f805c4df742c9
  pdf-lib-1.17.1.min.js     pdf-lib 1.17.1                    –  package "pdf-lib", file dist/pdf-lib.min.js
                            licence: MIT             sha256: 0f9a5cad07941f0826586c94e089d89b918c46e5c17cf2d5a3c6f666e3bc694f
                            (update-176) one page of an old log book's PDF taken out for the AI – on the page and on the
                            server (server/syncfetch.js, in its helper thread); it only reads and copies pages, nothing is run.

build.js copies every .js of this folder to public/vendor/. The file name carries the version: to change a version, add
the new file under its own name, change the name in app/App.html (rclVendor(…)) and delete the old file.
Known: SheetJS 0.18.5 is the last version published on npm; newer ones (which fix two reported weaknesses in READING
files) are only on the maker's own site. The app reads only Excel files chosen by a signed-in user.
