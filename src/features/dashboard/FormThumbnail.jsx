import { themeOf, themeStyle } from '../../lib/theme.js'
import { useTheme } from '../../lib/useTheme.js'

// Miniature render of a form's first few questions — the card preview,
// in the form's own theme colour, background and header image.
export default function FormThumbnail({ title, questions = [], theme }) {
  const { theme: mode } = useTheme()
  const formTheme = themeOf({ theme })
  const header = formTheme.headerImage?.url
  const style = themeStyle(formTheme, mode === 'dark')
  style.background = 'var(--bg)'
  return (
    <div className="thumb" aria-hidden="true" style={style}>
      <div className="thumb-sheet">
        {header && <img className="thumb-header" src={header} alt="" loading="lazy" />}
        <div className="thumb-block thumb-title">{title || 'Untitled form'}</div>
        {questions.slice(0, 3).map((q) => (
          <div key={q.id} className="thumb-block">
            <span>{q.title || 'Untitled question'}</span>
            {q.options ? (
              q.options.slice(0, 2).map((o, i) => (
                <span key={i} className="thumb-option">
                  {o}
                </span>
              ))
            ) : (
              <span className="thumb-line" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
