import { createHash } from 'node:crypto'

// Fixed-window counter in rateLimits/{hash}. Keys are hashed so raw IP
// addresses are never stored. Returns false once `limit` hits land inside
// `windowMs`. Clients can't read or write rateLimits (no rule matches it).
// expireAt lets a Firestore TTL policy clean old windows up.
export async function allow(db, key, limit, windowMs) {
  const id = createHash('sha256').update(key).digest('hex').slice(0, 40)
  const ref = db.doc(`rateLimits/${id}`)
  return db.runTransaction(async (tx) => {
    const now = Date.now()
    let { start = 0, count = 0 } = (await tx.get(ref)).data() ?? {}
    if (now - start > windowMs) {
      start = now
      count = 0
    }
    if (count >= limit) return false
    tx.set(ref, { start, count: count + 1, expireAt: new Date(start + windowMs * 2) })
    return true
  })
}

// The caller's IP behind Google's front end.
export function clientIp(rawRequest) {
  const forwarded = rawRequest?.headers?.['x-forwarded-for']
  return (forwarded ? String(forwarded).split(',')[0] : rawRequest?.ip ?? 'unknown').trim()
}
