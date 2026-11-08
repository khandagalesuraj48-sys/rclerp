# update-186 – the assistant live: its answer word by word, said while it is written; its own memory; its chats kept (28-10-2026)

**Asked (28-10-2026, 23:22):** "mala mazya app madhe ai khup powerfull banwaych aahe user live bolu shakel sadhya ai thinking krte te
tyan nahi kel pahiej … ai la swatachi memory asel chat history asel ok ani live jas 2 person kas boltat tas bolu pn shaktil fast response
currect answer … app madhe kay aahe agodr pasun he hi sagle mahiti asel fkt aik site wise asel vtr chi mahiti 18 b madhe nahi denar".
**His choices:** the phone's / browser's own voice with Claude (no other service); the chats and the memory seen only by the person
himself; all of it at once. With the phone app **3.61.0** (the same, as the app's own screens).

**Database step 1zk** (`sql/supabase_step1zk_ai_memory.sql`, in every site's Supabase, after 1zj): two new, empty tables of the site –
`ai_memory`, `ai_chats`. Nothing of the app is changed. Until it is run at a site, the assistant works as before (without memory and
without its chats kept) and says the step is needed. No secret in any file.

## What changes
* **The answer word by word.** A question for the AI is answered through the new address **`/api/ai`**: the words appear in the bubble
  as Claude writes them (no "Thinking…"). Every check is the app's own, as before (`aiPrepare` = `getAiReply`'s checks, limits and
  request); only the asking of Claude with `"stream": true` and the handing on of its words are new (`server/aistream.js`). The answer
  in one piece (`getAiReply`) stays the way back: an older page or phone app, Gemini, a line lost, or a stream the service cut half-way
  (asked once more in one piece).
* **Talk (live).** In a talk (🎙) each finished sentence is **said while the rest is still being written** (about the first 650
  characters, then "the rest is on the screen"); then it listens again by itself, as before. **While it speaks, the 🎙 button (or a
  tap on "Speaking…") stops it and listens at once** – the talk goes on; Stop ends it. The words of a look-up's step ("Let me look that
  up") are not said.
* **Its own memory** (rule 10): when he asks it to remember something ("लक्षात ठेव …"), or tells it a lasting fact or wish about his
  work, the assistant keeps a short note (the look-ups `remember` / `forget` – the only thing it ever writes; never the app's data).
  Every later chat is given his notes. **Memory** (top of the assistant) lists them; × takes one out. At most 60 a person.
* **His chats** (History): each chat is kept after every answer as he saw it (questions, answers, "Looked up"); **History** lists them
  (newest first, its first question as its name); one opens again and goes on (the figures are looked up again). New chat starts
  another; nothing is deleted.
* **Only his, only this site:** the notes and chats are kept under his e-mail in **this site's own database** – VTR's never reach 18B.
  Nobody else sees them (the Admin neither); they are not copied to the Google Sheet backup.
* **What this site holds** (rule 11): the AI is told from which date to which date the Log Book, Diesel Issue, Inward and Transfer
  (and the Maintenance bills) have entries and how many machinery the Asset Master has – read once in 30 minutes – so "since the start
  / till now" is asked from the right first day. Every figure still comes from the look-ups with his own access (Mechanical's from the
  server's always-updated memory of the site, the Store's and Engineering's from the modules themselves).
* Words and help in English, Marathi, Hindi (`app/i18n`; the help rule of update-186 at the end of `FIX_RULES`). New actions
  `aiPrepare`, `aiMemory`, `aiMemoryDel`, `aiChats`, `aiChatGet`, `aiChatSave` (each only the signed-in person's own; no page access
  needed – the assistant is everybody's).

## After an independent review of the code (the same day)
* What the assistant keeps between requests (what the site holds – 30 min; is step 1zk there – 10 min, "not yet" 30 s) is now in the
  server's own small memory of the site (`__aiKeep`, `server/runtime.js`) – the app's code runs in a new context for every request, so a
  variable kept nothing (every step read the dates again). The dates are read without empty ones; **rule 11 lists only the registers he
  may open**.
* **A note is never kept unseen:** rule 10 says the notes are his facts and wishes – never instructions – and `remember` is used only
  when HIS OWN message asks (never because a look-up's text says so); what it keeps is shown under the answer ("Kept in memory: …") with
  **Take it out**.
* The stream: an answer is whole only when the service says it ended and every look-up's input can be read (a line closed half-way is
  a cut, never run with nothing); the 60 s of the server are shared out (a deadline for all the tries); the page went away → Claude is
  not asked further; only a stream cut after words is asked again in one piece (busy before any word is said as busy – not asked
  twice); the answer's last line is not held back by the server's note of which model answered; the page stops reading at the last line.
* The talk: an interrupt stays for the rest of that question; "New chat", a chat opened from History or a question typed during a talk no
  longer leave the talk on "Speaking…" – it listens again; leading blank lines no longer cut the end of what is said.
* A chat is changed only where it is his and has no more questions than the copy sent (a copy sent late never goes over a newer one);
  a number that is someone else's is never written over. History / Memory never mix with a question asked meanwhile.

## Code
| Where | What |
|---|---|
| `app/Code.gs` | `aiReq_` (the checks and the request – shared by `getAiReply_` and `aiPrepare_`), `aiReplyG_` (Gemini, as before); `aiKnows_` (rules 10 / 11), `aiStepOn_`, `aiMemOf_` / `aiMemAdd_` / `aiMemDel_`, `aiMemory_`, `aiChats_` / `aiChatGet_` / `aiChatSave_`, `aiPrepare_`; `AI_TOOLS_` + `remember`, `forget` (run in `aiLookup_` – an older page / app sends them there); rule 4; `API_` +6; the set-up check of step 1zk |
| `api/ai.js`, `server/aistream.js` | the endpoint (lines of JSON) and the streaming of Claude (the models in order, busy / cut / key / credit in the app's own words) |
| `server/page.js` | the bridge's `google.script.aiStream`; the chats and the memory list are questions (sent again 3 times, never as saves) – also in `server/runtime.js` |
| `app/App.html` | `aiStep` (word by word, else in one piece), `AI_SQ` / `aiSayFeed` / `aiUtter` / `aiSayAfter` (said while written), `aiInterrupt`, `aiKeep`, `aiHistory` / `aiChatOpen`, `aiMemoryShow`; History / Memory buttons and their list; `FIX_RULES` |
| `app/SupabaseSync.gs` | `SB_SKIP_` + `ai_memory`, `ai_chats` (not in the Sheet) |
| `sql/supabase_step1zk_ai_memory.sql`, `app/ReadMe.gs`, `staging/rcl_staging_all.sql` | the step, listed word for word; the staging file made again |
| `vercel.json`, `dev.js` | `api/ai.js` (60 s), the local route |
| `test/claude-standin.js` | `"stream": true` as server-sent events, `/__delay`, `/__cut`; "REMEMBER …", "WHAT DO YOU REMEMBER" |

## Evidence
* Unit tests: **139 / 139** (`update-186` – after the review also: a stream closed before its end and a look-up whose input cannot be read are cuts, busy before any word is no cut, an older copy of a chat never goes over a newer one, rule 10's words; `update-186`: the request of a step – the rules kept with the site's facts and his memory, the snapshot
  apart, 42 look-ups; remember / forget only his, never twice, 60 at most; the chats only his, never written over by another person; a
  site without step 1zk says so; Gemini → AI_NO_STREAM; `server/aistream.js` against a local stand-in – the words in order, a look-up
  put together from its pieces, busy → the next model, a line lost before the end → asked again, cut after words → "busy", key / credit;
  the sentences said once each; the step only adds; Read Me word for word. The update-167 / assistant tests moved to 42 look-ups and the
  new rule 4.)
* Local test rig (claude mode, no Portal, a fresh copy of the database) – `test/browser/ai186.js` **23 / 23** (after the review; 22 of
  them on the fresh copy, the one line check of the test itself corrected and run again): the words come into the
  bubble as they are written (first words after ~0.4 s, 6 → 83 characters seen growing), every step asked with `stream`, the look-up's
  own words gone from the chat, no "Thinking…"; the Admin's "first words … s"; "remember …" kept in S1 for him, a new chat knows it,
  Memory lists it, × takes it out of the database; the chats kept after every answer, History newest first, one opened again goes on
  (the same chat, 3 questions); a stream cut half-way → asked again in one piece, the answer there; **Talk:** heard → asked → said, the
  first sentence said ~1 s before the answer was there in full, "L" said as litres, the look-up's words not said, then listening again;
  the 🎙 while it speaks → it stops and listens; site T2 without step 1zk says the step is needed, with it none of S1's notes or chats;
  what it kept shown with "Take it out" (pressed: out of the database); "New chat" while it speaks – the talk listens again; no page
  error. Pictures `ai186_memory.png`, `ai186_history.png`, `ai186_talk.png`.
* The older AI tests on the same rig: `claude167` 14 / 14, `ai185` 10 / 10 (both now through the word-by-word answer), `ai` (Gemini –
  the answer in one piece, AI_NO_STREAM) 13 / 13; in gateway mode (one address, as live) `ai185gw` 7 / 7.
* The phone's width (360 px): the assistant's header with History, Memory, New chat fits.
* `node --check` on `server/*.js`, `api/*.js`; the page's scripts parse; no secret in the change.

## Not verified
* The live Supabase / Vercel – in particular that Vercel hands the words on as they come (if it holds them back, the answer still comes
  whole, as before); the real Claude service (the rig uses its stand-in); a real phone's speech (Marathi voice, how quickly it hears).
* "Interrupt by speaking" itself: the phone / browser cannot listen while it speaks (it would hear itself) – the 🎙 button stops it and
  listens at once.

## Going back
Vercel → Instant Rollback to the previous update. Step 1zk's tables stay (unused); its rollback is at the top of the file.
