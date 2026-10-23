// Google Sheets for "Link to Google Sheets": the form owner approves the
// narrow drive.file permission (only files PeraForm creates), PeraForm
// creates "<form> (Responses)" in their Drive and keeps it up to date.
// Plain REST calls (fetch); `http` can be swapped in tests.

export const SCOPE = 'https://www.googleapis.com/auth/drive.file'
export const SHEET = 'Responses'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets'

export class GoogleError extends Error {
  constructor(status, body) {
    super(body?.error_description || body?.error?.message || body?.error || `Google error ${status}`)
    this.status = status
    // The person removed PeraForm's access (or the link was revoked).
    this.revoked = body?.error === 'invalid_grant' || status === 401
  }
}

async function call(http, url, options = {}) {
  const res = await http(url, options)
  const text = await res.text()
  const body = text ? JSON.parse(text) : {}
  if (!res.ok) throw new GoogleError(res.status, body)
  return body
}

const form = (data) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(data).toString(),
})

// The browser's one-time code (Google Identity Services, popup) → tokens.
// redirect_uri 'postmessage' is how the popup code flow is redeemed.
export function exchangeCode(http, { code, clientId, clientSecret }) {
  return call(
    http,
    TOKEN_URL,
    form({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: 'postmessage', grant_type: 'authorization_code' }),
  )
}

export async function accessToken(http, { refreshToken, clientId, clientSecret }) {
  const body = await call(
    http,
    TOKEN_URL,
    form({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }),
  )
  return body.access_token
}

export function revoke(http, token) {
  return http(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => {})
}

const auth = (token, extra = {}) => ({ headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...extra })

export async function createSpreadsheet(http, token, title) {
  const body = await call(
    http,
    SHEETS,
    auth(token, {
      method: 'POST',
      body: JSON.stringify({
        properties: { title },
        sheets: [{ properties: { title: SHEET, gridProperties: { frozenRowCount: 1 } } }],
      }),
    }),
  )
  return { spreadsheetId: body.spreadsheetId, url: body.spreadsheetUrl }
}

// Answers go in as typed text (RAW) — never as formulas, so a respondent
// typing "=…" can't run anything in the owner's sheet.
function putValues(http, token, spreadsheetId, range, values) {
  return call(
    http,
    `${SHEETS}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    auth(token, { method: 'PUT', body: JSON.stringify({ range, values }) }),
  )
}

// Replaces everything with the header and all rows.
export async function writeAll(http, token, spreadsheetId, { header, rows }) {
  await call(http, `${SHEETS}/${spreadsheetId}/values/${encodeURIComponent(SHEET)}:clear`, auth(token, { method: 'POST', body: '{}' }))
  await putValues(http, token, spreadsheetId, `${SHEET}!A1`, [header, ...rows])
}

// Adds one response at the bottom; rewrites the header first if the form's
// questions changed since the last write.
export async function appendRow(http, token, spreadsheetId, { header, row, previousHeader }) {
  if (JSON.stringify(header) !== JSON.stringify(previousHeader)) {
    await putValues(http, token, spreadsheetId, `${SHEET}!A1`, [header])
  }
  await call(
    http,
    `${SHEETS}/${spreadsheetId}/values/${encodeURIComponent(`${SHEET}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    auth(token, { method: 'POST', body: JSON.stringify({ values: [row] }) }),
  )
}
