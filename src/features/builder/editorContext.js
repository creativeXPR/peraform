import { createContext, useContext } from 'react'

export const EditorContext = createContext(null)

// { form, draft, edit, undo, redo, canUndo, canRedo, saveState, setStatus }
// — see FormEditorProvider.
export function useFormEditor() {
  return useContext(EditorContext)
}
