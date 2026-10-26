# Guide: link previews (banner + per-form cards) for PeraForm

Hand-off for an AI agent. Goal, constraints, exact steps, and how to verify.
The owner (the user) chose **option 2**: every shared link shows a preview card,
and form links (`/f/:id`) show **that form's** title, description and header image.

---

## 0. Ground rules (read first — these come from the user)

- **No automatic changes to user content.** Never add a feature that edits saved
  data or overrides a choice on its own. Offer a button instead. Any new
  "auto" behaviour needs a planning session with the user *before* building it.
- **Commit, never push.** Commit each change on the current branch with a
  clear message ending in:
  `Co-Authored-By: <your model name> <noreply@anthropic.com>`
- **You can't deploy.** The user runs `firebase deploy` themselves. At the end,
  give them the exact commands (section 6). Never paste or ask for secrets.
- **Every delete/remove button** needs an "are you sure?" `ConfirmModal`
  (`src/lib/ConfirmModal.jsx`). (Not expected in this task.)
- **Don't send the user's email** to any third-party service.
- Write code that matches the surrounding code: comment density, naming,
  plain-English user-facing text.

## 1. Project facts

| Thing | Value |
|---|---|
| Repo | `C:\Users\IAR\Documents\code\peraform` (Vite + React SPA, `functions/` = Cloud Functions, Node, ESM) |
| Firebase project | `quality-toolsx` |
| Hosting site | `peraform-qt` → https://peraform-qt.web.app (`firebase.json` → `hosting`) |
| Functions | codebase `peraform`, region `europe-west1` (`functions/app.js` exports `REGION`, `db`) |
| Database | named Firestore DB **`peraform`** (`db` in `functions/app.js`; already the admin handle) |
| Forms | `forms/{formId}`: `title`, `description`, `status` (`draft` \| `published` \| `closed`), `theme.headerImage.url` (optional, https) |
| App URL param | `APP_URL` in `functions/mail.js` (= `https://peraform-qt.web.app`) |
| App Check | enforced on callables via `requireApp`; **not** needed for this `onRequest` function (public, read-only) |

Respondent links look like `https://peraform-qt.web.app/f/<formId>` (also
`?embed=1`, `?mode=prefill`, prefill query params — keep all working).

## 2. What to build

### 2a. Branded banner image (all links)

- Create `public/og-banner.png`, **1200×630 PNG** (not SVG — most link
  previewers ignore SVG), under ~300 KB.
- Look: PeraForm brand purple (`#4f46e5` → `#7c3aed` gradient works), the
  logo mark from `public/favicon.svg`, the word **PeraForm**, and a short line
  such as *"Forms people enjoy filling in."* Large, readable at thumbnail size,
  safe margins (~80 px) since apps crop.
- How to generate: write a small HTML page (inline the SVG logo, Inter font)
  and screenshot it at 1200×630 with puppeteer-core + Edge
  (`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`), headless.
  Keep scripts in a scratch folder, not the repo.
- **If you cannot generate the banner** (no browser, no image tooling, or the
  result looks poor), **stop and tell the user to ask Claude (Opus, the
  previous agent) to generate it.** Don't ship a placeholder or a broken image.

### 2b. Default preview tags (every page)

In `index.html` `<head>` (keep the existing tags; add):

```html
<meta property="og:site_name" content="PeraForm" />
<meta property="og:type" content="website" />
<meta property="og:title" content="PeraForm" />
<meta property="og:description" content="Build forms and onboarding-style interviews, collect responses, and analyse them — by Quality Tools." />
<meta property="og:image" content="https://peraform-qt.web.app/og-banner.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
```

Use absolute `https://` URLs for images.

### 2c. Per-form cards (`/f/:id`)

Link previewers don't run JavaScript, so the HTML itself must carry the
form's tags. Add an HTTPS function that serves the app's `index.html` with the
form's tags swapped in.

1. **Pure helper** `functions/ogTags.js` (unit-testable, no Firebase imports):
   - `formMeta(form, appUrl)` → `{ title, description, image, url }` **only for
     `status === 'published'`**; otherwise `null` (drafts/closed get the default
     card — never reveal draft titles).
     - title: `form.title` (fallback "Untitled form"), trimmed to ~90 chars.
     - description: first ~200 chars of `form.description`, whitespace
       collapsed; fallback "Fill in this form on PeraForm."
     - image: `form.theme?.headerImage?.url` if it starts with `https://`,
       else `${appUrl}/og-banner.png`.
   - `injectOg(html, meta)` → replaces the default `og:title`,
     `og:description`, `og:image`, adds `og:url`, sets `<title>` to
     `"<form title> · PeraForm"`, and adds `twitter:title/description/image`.
     **HTML-escape every value** (`& < > " '`). If `meta` is null, return
     `html` unchanged.
2. **Function** `ogForm` in `functions/index.js` (`onRequest`, `REGION`,
   `memory: '256MiB'`, `maxInstances: 10`):
   - Parse the form id from the path `/f/:id` (ignore query; reject ids that
     aren't `[A-Za-z0-9_-]{1,64}` → serve default page).
   - Read `forms/{id}` with the admin `db` (select only `title`,
     `description`, `status`, `theme`). Never read questions/responses.
   - Get the app shell: `fetch(`${APP_URL.value()}/index.html`)` — `/index.html`
     is a real static file, so this does **not** loop through the rewrite.
     Cache the shell in memory for 5 minutes; cache form meta for 60 s.
   - Respond `200`, `Content-Type: text/html; charset=utf-8`,
     `Cache-Control: public, max-age=60, s-maxage=300`.
   - On any error: still serve the plain shell (never break the form link).
3. **Hosting rewrite** in `firebase.json`, placed **before** the `**` rewrite:
   ```json
   { "source": "/f/**", "function": { "functionId": "ogForm", "region": "europe-west1" } }
   ```
   Note the existing `headers` rule `**/!(*.*)` sets `Cache-Control: no-cache`
   on app routes; that's fine (correctness over CDN caching) — the function's
   in-memory caches keep it fast. Don't loosen app-route caching.
4. The React app needs no change (it boots from the same shell).

## 3. Tests

- **Unit** (`tests/unit/ogTags.test.js`, vitest): published → tags present and
  escaped (try a title with `<script>` and quotes); draft/closed → null;
  missing description/header image → fallbacks; `injectOg(html, null)` is a
  no-op. Run: `npx vitest run tests/unit` (all must pass; currently 220).
- **Lint/build:** `npx eslint src functions` and `npm run build` clean.
- **Emulators (optional, machine has little RAM — ~2 GB free):** use alt ports
  so the user's other emulators aren't disturbed. Create `firebase.alt.json`
  (gitignored) from `firebase.json` with emulator ports auth 9199,
  firestore 8180, functions 5101, hosting 5099, hub 4720, logging 4820,
  ui disabled. Kill only processes whose command line matches
  `firebase.alt.json|--port 5273|8180` when done.

## 4. Verify after the user deploys

- `curl -s https://peraform-qt.web.app/f/<publishedFormId> | grep -i "og:"`
  shows that form's title/description/image.
- A draft form id shows the default PeraForm card.
- Open the link in a browser: the form still works (normal, `?embed=1`,
  interview mode).
- Paste a link into https://www.opengraph.xyz/ to see the card. WhatsApp
  caches previews per link; test with a link not shared before (adding
  `?v=2` makes a fresh one).

## 5. Out of scope / don't touch

- Don't change respondent behaviour, App Check, billing, Keep, or the
  `suite`/`billing` databases.
- Don't add analytics or third-party scripts.

## 6. Deploy commands to give the user (they run them)

```
cd C:\Users\IAR\Documents\code\peraform
$env:FUNCTIONS_DISCOVERY_TIMEOUT=120
npm run build
firebase deploy --only hosting:peraform-qt,functions:peraform --project quality-toolsx
```
If some functions fail with "Quota exceeded", rerun the same command (it's a
temporary regional CPU limit during big rollouts).

Report back to the user in plain language: what changed, that it was tested
(say exactly what was and wasn't run), and the commands above.

---

# Part 2 — Emails: match Google Forms

Do this **after** link previews (or independently). Same ground rules as
section 0. Sending an email is not an "automatic change to content", but
**anything a respondent receives must be their choice or clearly stated
before they submit** (the user's consent rule).

## E1. Current state (already built — don't rebuild)

Mail goes out over SMTP from `functions/mail.js` (`sendMail`, `emailHtml`),
sender **"PeraForm by Quality Tools" <qualitytoolsx@gmail.com>**
(`functions/.env`: `SMTP_USER`, `MAIL_FROM`; secret `SMTP_PASS`).

| # | Email | Where | Status |
|---|---|---|---|
| 1 | New response → owners/editors who turned notifications on | `onResponseCreated` in `functions/index.js` | ✅ built |
| 2 | "X shared ‘form’ with you" → added editor / invitee | `manageCollaborators` (`add`) in `functions/index.js` | ✅ built |

Respondent email: the response stores `respondentEmail` **only if** the
respondent left the "Include my email with my response" switch on
(`shareEmail` sent to `submitResponse`; `src/features/respond/EmailConsent.jsx`).

## E2. What Google Forms also sends — build these

| # | Google Forms feature | PeraForm version to build |
|---|---|---|
| 3 | **Send responders a copy of their response** (setting: Off / When requested / Always) | Setting in Settings → Responses: **Off** (default) / **When requested** / **Always offered**. Respondent side: a checkbox **"Email me a copy of my answers"** near Submit (only shown when signed in with an email). *When requested* = unticked; *Always offered* = ticked by default but still un-tickable (consent rule — never force it). Email goes to the respondent's **own sign-in email from the auth token**, independent of the "share my email with the owner" switch (a copy to yourself doesn't share anything). |
| 4 | **Release scores by email** (quizzes, manual release) | When the owner releases scores (Responses → "Release all", `releaseAll` in `src/features/responses/ResponsesPage.jsx`, currently a client-side Firestore update), email each released respondent **who shared their email** their score and a link to view it. Must run server-side: add a callable `releaseScores({ formId, responseIds })` (editors only, `requireApp`), which sets `released: true` and sends the emails; switch `releaseAll` to call it. Respondents who didn't share an email still see their score on the results page as today. |
| 5 | **Send the form by email** (Send → envelope: recipients, subject, message) | In the Share/Send dialog: "Email the form link" with To (comma-separated), Subject (default "Please fill in: <title>"), Message. Callable `emailForm`. **Abuse limits** (our Gmail can be blocked for spam): verified-email accounts only, ≤ 25 recipients per send, ≤ 100 recipients per account per day via `functions/rateLimit.js` (`allow(db, key, limit, windowMs)`), published forms only, plain text message (escape HTML), each recipient sent separately (no exposed recipient list). |
| 6 | **Edit response link in the receipt** (when "Allow response editing" is on) | PeraForm has **no response editing** yet. Don't build editing as part of this; if it's added later, put an "Edit your response" link in email 3. Note this in your report. |
| 7 | **Ownership transfer** (Drive asks the new owner to accept) | Only if PeraForm supports transferring ownership (check `manageCollaborators`); if not, skip and mention it. |

Not sent by Google Forms (don't add): emails when a form closes, reminders,
marketing.

## E3. Email 3 content (respondent copy)

- Subject: `Your response to “<form title>”`
- Body: form title, submitted date/time (Africa/Lagos), then each **asked**
  question with the answer (skip unanswered/hidden ones; checkboxes joined
  with ", "; grids as "row: answer" lines; file uploads as file names, no
  links). Use `functions/responseTable.js` helpers where they fit.
- Footer: "You asked for a copy of your answers when you submitted this form.
  The form's owner can't see this email." No tracking pixels.
- Send from the `onResponseCreated` trigger (after grading), only when the
  response doc has `sendCopy: true`. `submitResponse` sets `sendCopy` from
  `request.data.sendCopy === true` **and** the form setting isn't Off. Store
  nothing else new.

## E4. Shared rules for all emails

- Use `emailHtml` for the layout; keep the plain-text version too.
- Never fail the main action because email failed: `try/catch` + `logger.error`
  (as emails 1–2 do).
- Gmail allows ~500 recipients/day. Count sends in a daily counter (e.g.
  `activity/{day}.emails` in the billing DB, like `countResponse`) and log a
  warning above 400; if it becomes a problem, switch SMTP to a provider such
  as Brevo — no code change, only `functions/.env` + `SMTP_PASS`.
- Firestore rules: if you add fields respondents write (`sendCopy`), it's set
  server-side in `submitResponse` — no client write rule needed. Check
  `firestore.rules` still passes (`npm run test:rules`, uses the default
  emulator port 8080 — only run if the user's other emulators aren't on it).
- Privacy page (`C:\Users\IAR\Documents\code\quality-tools\src\pages\Privacy.jsx`):
  add one line for each new email type (copy of answers, score release,
  form invitations), then rebuild that site.

## E5. Tests

- Unit: the respondent-copy formatter (all question types, hidden/unanswered
  skipped, HTML escaped).
- Emulator (alt ports, section 3): with `SMTP_PASS` unset, `sendMail` logs
  "Email not configured, skipping" — assert that log line / return value
  rather than sending real mail. Never send test emails to real people.

## E6. Deploy (user runs)

Same as section 6, plus the Quality Tools site if the Privacy page changed:
```
cd C:\Users\IAR\Documents\code\quality-tools
npm run build
firebase deploy --only hosting --project quality-toolsx
```

---

# Part 3 — Design screens: align and snap vertically as well as horizontally

User report: in **Design screens**, blocks line up **horizontally only**;
they must line up **vertically too** — every alignment feature works on both
axes, consistently.

What the code already has (so this is a bug or gap in practice, not a missing
idea — find where vertical breaks):
- `snapFrame(frame, parent, distance, others)` in `src/lib/interview.js`
  computes both `x` and `y` (`pick(..., 'x', ...)` / `pick(..., 'y', ...)`),
  snapping to the parent's start/centre/end and to sibling blocks' edges and
  centres, and returns guide lines `{ axis, at }`.
- `Canvas.jsx` calls it while dragging (`snapFrame({ ...lead.f, x: lx, y: ly },
  parent, SNAP_PX / zoom, others)`) and draws guides (`renderGuides`).
- Inspector "Align" buttons (`ALIGN` in `Inspector.jsx`, `alignFrames` in
  `interview.js`): left / centre / right **and** top / middle / bottom.

Do:
1. **Reproduce** on the canvas (drag a block near another block's top, middle
   and bottom; near the card's top/middle/bottom). Check each piece:
   - y snapping actually applied to the dropped frame (not overwritten by x
     logic or by the group-drag path for multi-select);
   - **horizontal guide lines** (`axis: 'y'`) are drawn and visible (CSS for
     both orientations; correct position/scale with zoom; inside rotated or
     nested cards);
   - snapping while **resizing** (top/bottom handles) as well as moving — if
     resize doesn't snap at all, add it for all four edges;
   - the parent box passed for root-level cards has a real height (screen
     height via `stageHeight`, not `undefined`/0).
2. **Fix** whatever is horizontal-only so moving and resizing snap on both
   axes with equal priority (closest edge/centre wins per axis, independently).
3. **Add "Distribute"** to the Inspector's multi-select align row: *Distribute
   horizontally* and *Distribute vertically* (equal gaps between 3+ selected
   blocks in the same card), with a pure helper beside `alignFrames` and unit
   tests. One undo step, like Align.
4. Unit tests in `tests/unit/interview.test.js`: `snapFrame` snaps y to a
   sibling's top, middle and bottom and to the parent's middle, and returns a
   `y` guide; `alignFrames(…, 'top'|'middle'|'bottom')`; the new distribute
   helper.
5. Browser check (alt-port emulators, section 3): drag a block near another's
   middle → it snaps and a horizontal guide shows. Report exactly what you ran.

No automatic behaviour beyond snapping while the user drags (snapping is
already accepted). Commit; give the user the hosting deploy command
(section 6).
