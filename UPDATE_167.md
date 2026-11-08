# update-167 – Claude for every AI of the app (27-10-2026)

**Asked (27-10-2026, 14:58 – 15:10):** "apan aple app amdhe Gemini API lawale ahe … tith mala Claude API lawaychi aahe, Claude API
key milali aahe" – then: "tu apli software sathi Claude API sathi perfect banaw, coding sagle zale nantr mg sang mi key store krel
… mala fkt all app madhla AI perfect chalayla hawa". His Claude Console (picture): organization credits $200, a $500 monthly tier
limit, the models Fable 5.1, Opus 5.5, Sonnet 5.5, Haiku 5.5.

**No database step. No key in any file** – the key goes only into Vercel (below), by him.

## What changes
* **The server's line to the AI (server/gas.js `makeAi`)**: with `ANTHROPIC_API_KEY` in the server's settings, every AI question
  goes to **Claude** (`https://api.anthropic.com`, headers `x-api-key` and `anthropic-version: 2023-06-01`); without it, Gemini
  exactly as before (`GEMINI_API_KEY`). Both set: Claude. A key is used without the spaces / new line a copy-paste can bring.
  `ANTHROPIC_MODEL` fixes the model; `ANTHROPIC_API_BASE` is for tests only.
* **Everything that uses the AI goes with it** (app/Code.gs, the Claude block after `aiInfo_`):
  * **The assistant** (`getAiReply`, web and phone): the same rules, the same 11 look-ups (in Claude's JSON Schema), the same
    limits (150 an hour a person, 5,000 a day a site). The page and the phone app are NOT changed for it: they send and get the
    conversation as always (role user / model, parts text / functionCall / functionResponse); the server puts it into Claude's
    words (user / assistant, text / tool_use / tool_result – each look-up a number, its result matched to it; a look-up left
    without its result gets "no result" so Claude accepts the conversation) and Claude's answer back into those parts. The
    FIGURES still come only from the look-ups, run by the page with the person's own sign-in.
  * **The meter / pump photos** (`getMeterReading`: dashboard, Hour meter, dispenser) and **the maintenance bills**
    (`readMaintBill`: a photo, or a PDF as Claude's "document"): the same questions; Claude is asked for JSON in the question's
    words; the app's own checks of the readings (`pickReading_`, `pumpAnswer_`, `maintAnswer_`) are unchanged. A bill gets 40
    seconds (a meter 25).
  * **"Test the AI service"** (Admin, in the assistant): "Service: Claude", each model with its time or what it said.
* **The models:** the one fixed in `ANTHROPIC_MODEL`; else from Claude's own list (`GET /v1/models`, kept a day in `AI_MODEL_C` –
  apart from Gemini's `AI_MODEL`): the newest **Sonnet** first (reads a bill or a meter carefully, answers in seconds), then the
  newest **Haiku** (the fastest – asked when Sonnet is busy). The list cannot be read: these two by name, asked again in an hour.
  Busy (529 overloaded, 429, 5xx, no connection): the same model once more after 1.5 s, then the next; the one that answered is
  asked first afterwards. A model the service no longer has (404): the next.
* **The cost:** the rules and the look-ups are the same in every step of a question – Claude keeps them (prompt caching,
  `cache_control`, 5 minutes): the later steps pay about a tenth for that part. The snapshot of the moment is sent after the kept
  part. No "thinking" is asked (the figures come from the look-ups; it would cost seconds and money).
* **What Claude says is said plainly:** no credit left in the company's Claude account → "The AI service has no credit left
  (Claude): the Admin has to add funds in Claude Console → Billing. The rest of the app works as always." (not asked again); a key
  it does not take (401 / 403) → "The AI service did not accept its key (…) – … ANTHROPIC_API_KEY …"; for a photo / bill the same
  reason inside its usual message ("… could not read the meter now (no credit left in Claude Console) – type the reading.").
* **Help in English / मराठी / हिंदी** (`FIX_RULES`): a new rule for no credit / a key not taken (what to do in Claude Console and
  Vercel); "assistant is not set up" and the general AI rule now name Claude Console and `ANTHROPIC_API_KEY`. The words of the
  page and the server (`app/i18n`: 6 new texts, the 2 Gemini-only ones replaced).
* **README.md:** "AI – Claude" – how to put the key.
* **The phone app** (rcl-mobile 3.48.0, its own pull request): only words – "Test the AI service" names the service and, when no
  model answers, says to look at the key and the credit in Claude Console; the not-set-up words; the web's help and words taken
  again. Its own photo reading (ML Kit on the phone) is not changed.
* VTR / 18B / HO: the same server for all – Claude for every site once the key is in.

## How he switches it on (after the merge)
1. Claude Console → **API keys** → Create key. It is shown once – never in chat, mail or a file.
2. Vercel → the Mechanical project → Settings → Environment Variables → `ANTHROPIC_API_KEY` = the key, Environment **Production** → Save.
3. Vercel → Deployments → the latest → **Redeploy**.
4. The app → Ask → (Admin) **Test the AI service**: "Service: Claude", ✓ claude-sonnet… and ✓ claude-haiku….

## Evidence
* `timeout 300 node --test test/unit.test.js` → **121 / 121 pass** – new `update-167` (with a recording stand-in for the AI line):
  the 11 look-ups in JSON Schema (small letters, an empty object for none); the page's conversation → Claude's (pairs by number and
  name, an unanswered look-up → "no result" first, a stray result → text, Gemini's own marks not sent, one turn for two of a side);
  Claude's answer → the page's parts; a question: the list of models then Messages (the newest Sonnet, rules with `cache_control`,
  the snapshot after them, no temperature), the order kept a day; the next step with the look-up and its result, the list not
  asked again; busy: Sonnet twice (1.5 s wait) then Haiku, Haiku first afterwards; every model busy → the busy words with what it
  said; no credit / 401 / a refusal / an empty answer – each said, not asked again; a JPG photo (image block) and a PDF bill
  (document block, 8,192 tokens, more time); no credit and busy for photos; "Test the AI service" (service, each model); a list
  that cannot be read → the two by name for an hour; a wrong key → said; Gemini exactly as before (its address, words, order,
  `AI_MODEL_C` untouched); no key → "not set up" naming ANTHROPIC_API_KEY; the help rules for the new messages in 3 languages.
  The help coverage test and the language test (update-110) pass with the new texts.
* `node --check` on `server/*.js` and `api/*.js`; the page's script blocks parse; acorn: no call lost in App.html, Code.gs,
  Sites.gs, SupabaseData.gs, SupabaseSync.gs, server/portal.js; no secret in the change (the stand-in's "test-key-c" is a test value).
* **The local rig** (Postgres + PostgREST + Portal + Mechanical; the AI is a stand-in – no real Claude or Gemini was asked):
  * **Claude** – `test/claude-standin.js` (as strict as the Messages API: key, version header, user first and one side after the
    other, a result for every look-up first in the next turn, none without its look-up, no empty text, JSON Schema in small
    letters) with the servers started with `ANTHROPIC_API_KEY`: new `test/browser/claude167.js` **14 / 14** (a diesel question
    end to end with the database's figure; the chat going on with two look-ups and their results accepted; the snapshot in one
    step, sent after the kept part; an entry only prepared – nothing saved; Sonnet busy once / all along → Haiku; no credit – the
    words and the Marathi help; a meter photo as an image block; the Admin's test). `photo139.js` **11 / 11**, `photo85.js` 32 /
    35 and `aido.js` 14 / 15 – the same lines fail on main with Gemini (below), none of them an AI line.
  * **Gemini, main and this branch side by side** (the same rig state): ai 12/13, ai2 6/6, ai3 0/4, aibusy 6/6, aido 14/15, photo85
    32/35, photo139 11/11 – **every PASS / FAIL line the same on main and on the branch** (the failures are of this rig's data and
    time – the user's name "Sujit Test", an empty site, today's date, the location cover in headless Chromium – not of this update).
  * `mnt165.js` (the Maintenance page of HO; the bill read by the AI): **32 / 32** on main with Gemini, on the branch with Gemini,
    and on the branch with **Claude** (its stand-in got the PDF bill as a "document" and the bill photo as an "image", both to
    Sonnet, JSON asked). Each of these runs: the Portal's own `api.test.js` 117 / 117 first.
* **Not verified:** a real Claude answer (no key here – the first real check is his "Test the AI service" after he puts the key);
  real reading quality of meters and bills by Sonnet / Haiku; real latency and cost per question; the phone app (its own build).

## Going back
* At once, without any deploy: Vercel → Environment Variables → remove `ANTHROPIC_API_KEY` (or rename it) → Redeploy: Gemini as
  before (with `GEMINI_API_KEY`).
* The code: Vercel → Instant Rollback to update-166.
