# update-216 – Vehicle Booking and Vehicle Expenses (toll / FASTag / parking) – database step 1zm (09-11-2026)

**Asked:** the features for HO and every site – "ata he sagle ek sath bana ani ha ho sathi pn ani other site sathi pn he hawe aahet".
**This is part 2** (features 8 and 10). His answers: a booking is approved by those given a **new right** "Vehicle Booking – approve" (the
Super Admin gives it site-wise in the Portal); toll **by hand + the statement**; the statement **read by the AI** ("AI ने वाचावे"); the SQL
approved ("हो, बनवा"). With **rcl-mobile 3.91.0**. Comes after update-215 (merge 213 → 214 → 215 → this).

## ⚠ Database step – he runs it himself, in EVERY site's Supabase (VTR, 18B, HO, …)
`sql/supabase_step1zm_booking_expenses.sql` (also in Read Me → SQL steps): two new tables `vehicle_booking`, `vehicle_expense` and three
empty access columns in `app_users` (`perm_vehicle_booking`, `perm_booking_approve`, `perm_vehicle_expenses` – empty = No access). It
only ADDS; nothing is changed or deleted; safe to run again (it was run twice on the test copy). Before it is run at a site, the two
pages there say "This needs one database step first …" and nothing is written; every other page works as before. The database check
(Admin → Database) lists it until it is run.

## What changes
1. **Vehicle Booking** (new page, Machinery menu; `getBookings`, `saveBooking`, `decideBooking`, `cancelBooking`):
   * a person with the page (Edit) asks: needed from / until (date + time; not past; at most 31 days), from where, to where, purpose,
     people, the vehicle he wants (optional), remark → **Requested**; a message to those who approve (the right "Vehicle Booking –
     approve", the site's Admins and the Super Admin);
   * one who approves sees every booking of the dates and **gives it – the vehicle and its driver** (Approved) or says no with why
     (Rejected); the person gets a message. **A vehicle is never given to two bookings at the same time** (refused, naming the other);
     an approved booking's vehicle can be changed;
   * cancelled by the person who asked (or one who approves) before it is over; a person sees only his own bookings.
2. **Vehicle Expenses** (new page; `getVexp`, `saveVexp`, `updateVexp`, `deleteVexp`, `readVexpStatement`, `importVexp`): toll / parking /
   other of a vehicle – date, vehicle (in the Asset Master, on the site that day), what, place, ₹, paid by (FASTag / Cash / Card / UPI /
   Other), reference, remark; each vehicle's total of the dates. **The FASTag statement**: a PDF or a photo (read by the AI as it is) or
   the Excel / CSV (its rows sent as text) → each toll line put on the vehicle of its number; seen first, only the ticked lines saved
   together; **a line already saved (its transaction ID, or the same vehicle, date, ₹ and plaza) is never saved twice** (also a unique
   index on the transaction ID).
3. **Access**: three new pages in the Portal → Users & Access → Pages: Vehicle Booking, **Vehicle Booking – approve**, Vehicle Expenses;
   empty = No access (nobody sees them until given); each action checked on the server. Vehicle Expenses has the 4th access "Admin"
   (entries of an earlier day) as every page with a date.
4. Activity Log: every booking / expense saved says what it did. Help for the new messages in 3 languages (`FIX_RULES`); the page guides.

## Evidence
* Unit: `timeout 500 node --test test/unit.test.js` – **169 / 169**. New `update-216` (the two tables as PostgREST answers, in memory):
  a booking refused when View only, without until, until before from, past, no purpose, wrong people – nothing kept; asked → those who
  approve get the message (not the one who asked); a person sees his own, one who approves all; decided only by the right; no vehicle
  → refused; approved with vehicle + driver → the person's message; **the same vehicle at the same time refused**; Rejected needs why; a
  decided booking cannot be decided again; cancelled only by the person / one who approves; a cancelled booking frees its vehicle.
  Expenses: refused (kind, paid by, amount, not in Master), saved, changed, deleted, each vehicle's total; the statement: View refused,
  nothing given refused, an Excel sent as rows, matched by number ("VB CAR 1" → VB-CAR1), an already-typed line marked, a line with no
  date left out; saving with a line without vehicle → nothing saved; saved 2 / 1 already there; the same again → nothing added; step
  1zm not run → the pages say so, a save refused; the access of the three pages and every action; the SQL only adds.
* The rig in Chromium (`scratchpad/hod/web216.js`, **15 / 15**): step 1zm run twice in the test copy; booking asked, approved, a clash
  refused, cancelled (API); through the page – asked, decided with the vehicle and driver; an expense typed; a FASTag statement photo read
  by the AI stand-in – one line on its vehicle (ticked), one with no such vehicle (not ticked); saved; read again = already saved; the
  Portal lists the three pages ("Vehicle Booking – approve"); no page error. The test rows put back after.
* `node --check` on `server/*.js`, `api/*.js`; the page's 7 script blocks parse; staging SQL rebuilt; no secret in the change.

## Not verified
* The live sites (step 1zm not run there yet); the real AI reading a real bank's FASTag statement (the rig's AI is a stand-in); the
  messages on a real phone.
* The two new tables are not yet in the Google Sheet backup (they are in Supabase's own backups).

## Going back
Vercel → Instant Rollback. The two tables and three columns stay (empty / unused by the update before); nothing else is touched.
