import { describe, expect, it } from 'vitest'
import { responseTable } from '../../functions/responseTable.js'
import { GoogleError, appendRow, exchangeCode, writeAll } from '../../functions/sheets.js'
import { responsesToCsv } from '../../src/features/responses/summarize.js'

// A fake fetch that records calls and answers from a queue.
function fakeHttp(...replies) {
  const calls = []
  const http = async (url, options = {}) => {
    calls.push({ url, ...options })
    const [status, body] = replies.shift() ?? [200, {}]
    return { ok: status < 400, status, text: async () => JSON.stringify(body) }
  }
  return { http, calls }
}

const questions = [
  { id: 'q1', type: 'shortText', title: 'Name' },
  { id: 's', type: 'section', title: 'Part 2' },
  { id: 'q2', type: 'checkboxes', title: 'Pets', options: ['Cat', 'Dog'] },
]
const responses = [
  { submittedAt: new Date('2026-01-02T10:00:00Z'), answers: { q1: 'Bo', q2: ['Dog'] } },
  { submittedAt: { toDate: () => new Date('2026-01-01T09:00:00Z') }, answers: { q1: '=HYPERLINK("x")', q2: ['Cat', 'Dog'] } },
]

describe('responseTable', () => {
  it('builds the header and rows, oldest first, skipping sections', () => {
    const { header, rows } = responseTable(questions, responses)
    expect(header).toEqual(['Submitted at', 'Name', 'Pets'])
    expect(rows).toEqual([
      ['2026-01-01T09:00:00.000Z', '=HYPERLINK("x")', 'Cat; Dog'],
      ['2026-01-02T10:00:00.000Z', 'Bo', 'Dog'],
    ])
  })

  it('adds the email column when asked, even before anyone has one', () => {
    expect(responseTable(questions, [], { withEmail: true }).header[1]).toBe('Email address')
  })

  it('is exactly what the CSV download contains', () => {
    const { header, rows } = responseTable(questions, responses)
    const firstLine = responsesToCsv(questions, responses).split('\r\n')[0]
    expect(firstLine).toBe(header.join(','))
    expect(responsesToCsv(questions, responses).split('\r\n')).toHaveLength(rows.length + 1)
  })
})

describe('Google Sheets calls', () => {
  it('redeems the popup code with redirect_uri postmessage', async () => {
    const { http, calls } = fakeHttp([200, { access_token: 'a', refresh_token: 'r' }])
    const out = await exchangeCode(http, { code: 'c1', clientId: 'id', clientSecret: 'sec' })
    expect(out.refresh_token).toBe('r')
    const body = new URLSearchParams(calls[0].body)
    expect([body.get('code'), body.get('redirect_uri'), body.get('grant_type')]).toEqual([
      'c1',
      'postmessage',
      'authorization_code',
    ])
  })

  it('writes everything as plain text (RAW), clearing first', async () => {
    const { http, calls } = fakeHttp()
    await writeAll(http, 'tok', 'sheet1', responseTable(questions, responses))
    expect(calls[0].url).toContain(':clear')
    expect(calls[1].url).toContain('valueInputOption=RAW')
    expect(JSON.parse(calls[1].body).values).toHaveLength(3)
  })

  it('only rewrites the header when the questions changed', async () => {
    const same = fakeHttp()
    await appendRow(same.http, 'tok', 's', { header: ['A'], row: ['1'], previousHeader: ['A'] })
    expect(same.calls).toHaveLength(1)
    expect(same.calls[0].url).toContain(':append')

    const changed = fakeHttp()
    await appendRow(changed.http, 'tok', 's', { header: ['A', 'B'], row: ['1', '2'], previousHeader: ['A'] })
    expect(changed.calls).toHaveLength(2)
    expect(JSON.parse(changed.calls[0].body).values).toEqual([['A', 'B']])
  })

  it('recognises revoked access', async () => {
    const { http } = fakeHttp([400, { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }])
    const err = await exchangeCode(http, { code: 'x', clientId: 'i', clientSecret: 's' }).catch((e) => e)
    expect(err).toBeInstanceOf(GoogleError)
    expect(err.revoked).toBe(true)
  })
})
