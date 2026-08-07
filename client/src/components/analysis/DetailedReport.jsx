import { CheckCircle2, Link2, AlertTriangle, TrendingDown, HelpCircle, ListOrdered } from 'lucide-react';

// Each report list rendered with a consistent icon + color.
const SECTIONS = [
  { key: 'validationReasons', label: 'Why this signal is valid', icon: CheckCircle2, color: 'text-green-500' },
  { key: 'confluences', label: 'Confluences detected', icon: Link2, color: 'text-brand-500' },
  { key: 'risks', label: 'Key risks', icon: AlertTriangle, color: 'text-yellow-500' },
  { key: 'weaknesses', label: 'Weak points', icon: TrendingDown, color: 'text-orange-500' },
  { key: 'missingElements', label: 'Missing elements', icon: HelpCircle, color: 'text-gray-400' },
];

/** Renders the AI's detailed reasoning report. */
export default function DetailedReport({ report }) {
  if (!report) return null;

  return (
    <div className="card p-6">
      <h3 className="font-semibold">Detailed Report</h3>

      {report.summary && (
        <p className="mt-3 rounded-xl bg-brand-50 p-4 text-sm leading-relaxed text-gray-700 dark:bg-brand-950/30 dark:text-gray-300">
          {report.summary}
        </p>
      )}

      {/* Step-by-step reasoning chain (Explanation engine). */}
      {Array.isArray(report.reasoning) && report.reasoning.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <ListOrdered className="h-4 w-4 text-brand-500" /> Raisonnement étape par étape
          </p>
          <ol className="space-y-2 border-l-2 border-brand-100 pl-4 dark:border-brand-900">
            {report.reasoning.map((step, i) => (
              <li key={i} className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        {SECTIONS.map((s) => {
          const items = report[s.key];
          if (!items || items.length === 0) return null;
          return (
            <div key={s.key}>
              <p className="mb-2 text-sm font-semibold">{s.label}</p>
              <ul className="space-y-1.5">
                {items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <s.icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.color}`} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
