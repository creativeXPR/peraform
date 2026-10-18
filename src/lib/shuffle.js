// One shuffle per page load, so options don't jump around while answering.
const SESSION_SEED = Math.floor(Math.random() * 2 ** 31)

function hash(text) {
  let h = SESSION_SEED
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 2654435761)
  return h >>> 0
}

// Deterministic shuffle (seeded by key + this page load).
export function shuffled(items, key) {
  let seed = hash(key)
  const random = () => {
    seed = (seed + 0x6d2b79f5) >>> 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
