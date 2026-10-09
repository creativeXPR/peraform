// Miniature render of a form's first few questions — the card preview.
export default function FormThumbnail({ title, questions = [] }) {
  return (
    <div className="thumb" aria-hidden="true">
      <div className="thumb-sheet">
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
