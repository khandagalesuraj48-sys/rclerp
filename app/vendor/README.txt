The two Excel tools the page uses, kept here so the app serves them from its own address (/vendor/…) instead of
fetching them from public file servers into the signed-in page (audit of 07-10-2026).

They are the unchanged files of the published packages (taken from the npm registry):

  xlsx-0.18.5.full.min.js   SheetJS Community Edition 0.18.5  –  package "xlsx", file dist/xlsx.full.min.js
                            licence: Apache-2.0      sha256: c9506197caf809a075b6dee1da0d36fb19da7158ffe8a88e7b0c96c5d8623c99
  exceljs-4.4.0.min.js      ExcelJS 4.4.0                     –  package "exceljs", file dist/exceljs.min.js
                            licence: MIT             sha256: 7e49da68588e250dbb8bba190d2caa8ab3787cc0284bda1d8b2f805c4df742c9

build.js copies every .js of this folder to public/vendor/. The file name carries the version: to change a version, add
the new file under its own name, change the name in app/App.html (rclVendor(…)) and delete the old file.
Known: SheetJS 0.18.5 is the last version published on npm; newer ones (which fix two reported weaknesses in READING
files) are only on the maker's own site. The app reads only Excel files chosen by a signed-in user.
