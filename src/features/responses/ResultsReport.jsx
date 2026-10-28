import { BarChart3, RefreshCw } from 'lucide-react'
import { formatCredits } from '../../../functions/billing/pricing.js'

// The "Analyse results with AI" card on the Summary view: an invitation
// before the first run, then the report (kept until the page is left).
const KIND = {
  'too-easy': 'Too easy',
  'too-hard': 'Too hard',
  'unused-option': 'Unused choice',
  'possible-problem': 'Check this',
  'strong-result': 'Worth knowing',
  other: 'Note',
}

export default function ResultsReport({ result, questions, onAnalyse }) {
  if (!result) {
    return (
      <section className="summary-card results-report">
        <h2>
          <BarChart3 size={18} aria-hidden="true" /> Analyse results with AI
        </h2>
        <p className="summary-count">
          Get a plain-language report on these results: questions that were too easy or too hard, choices nobody
          picked, and questions that may need a second look. Only totals are used — never anyone’s answers.
        </p>
        <button type="button" className="btn btn-outline" onClick={onAnalyse}>
          <BarChart3 size={15} /> Analyse results
        </button>
      </section>
    )
  }
  const { report, charged, at } = result
  const titleOf = (id) => questions.find((q) => q.id === id)?.title || null
  return (
    <section className="summary-card results-report" aria-live="polite">
      <h2>
        <BarChart3 size={18} aria-hidden="true" /> Results analysis
      </h2>
      <p>{report.summary}</p>
      {report.findings.length > 0 && (
        <ul className="report-findings">
          {report.findings.map((f, i) => (
            <li key={i} className={`report-finding report-${f.kind}`}>
              <span className="report-kind">{KIND[f.kind] ?? 'Note'}</span>
              <div>
                {titleOf(f.questionId) && <strong>{titleOf(f.questionId)}</strong>}
                <p>{f.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {report.nextSteps.length > 0 && (
        <>
          <h3>Next steps</h3>
          <ul className="report-steps">
            {report.nextSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </>
      )}
      <div className="report-foot">
        <span className="summary-count">
          Made {new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · used{' '}
          {formatCredits(charged)} credits · AI can be wrong; check before you act on it.
        </span>
        <button type="button" className="btn btn-ghost" onClick={onAnalyse}>
          <RefreshCw size={15} /> Analyse again
        </button>
      </div>
    </section>
  )
}
