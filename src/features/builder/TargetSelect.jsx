// "Continue to next section / Go to section N / Submit form" picker, used
// after a section and per option of a branching question.
export default function TargetSelect({ value, targets, onChange, label }) {
  // A target whose section was deleted reads as "next" (see formLogic.js).
  const current = targets.some((t) => t.value === value) ? value : 'next'
  return (
    <select
      className="target-select"
      value={current}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
    >
      {targets.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
    </select>
  )
}
