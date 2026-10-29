// Google's file picker is an ordinary layer on the page, and an open modal
// <dialog> makes everything outside it unclickable. So while the picker is
// up, every open dialog steps aside; they come back (in the same order)
// when it's done — picked, cancelled or failed.
export async function withDialogsAside(run) {
  const open = [...document.querySelectorAll('dialog[open]')]
  for (const d of open) d.close()
  try {
    return await run()
  } finally {
    for (const d of open) if (!d.open) d.showModal()
  }
}
