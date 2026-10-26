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
