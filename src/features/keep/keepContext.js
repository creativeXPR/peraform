import { createContext, useContext, useEffect } from 'react'

// Keep (lib/keep.js) for the app: keep(item) saves one, openKeep() shows
// the Keep, and pages say what can be pasted where they are.
export const KeepContext = createContext(null)

export function useKeep() {
  return useContext(KeepContext)
}

// A page's paste targets, while it's showing. Each is (data, kind) → void:
//   field — Edit questions: kept fields (and text/links as a text item)
//   block — Design screens: kept design blocks
//   text  — text and links (as a text block, or a title and description)
// Read when Paste is clicked, so they may change every render.
export function useKeepTargets(targets) {
  const keep = useKeep()
  useEffect(() => {
    keep?.setTargets(targets)
  })
  useEffect(() => () => keep?.setTargets(null), [keep])
}
