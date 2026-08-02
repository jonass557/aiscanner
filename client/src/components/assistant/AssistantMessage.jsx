import { useEffect, useState } from 'react';
import { Sparkles, Radio, FlaskConical, ListChecks, ShieldAlert, ChevronDown } from 'lucide-react';
import DecisionCard from '../analysis/DecisionCard.jsx';
import TradePlanCard from '../analysis/TradePlanCard.jsx';
import Badge from '../ui/Badge.jsx';
import Spinner from '../ui/Spinner.jsx';
import { analysisApi } from '../../services/endpoints.js';
import { renderMarkdown } from '../../utils/markdown.jsx';

/**
 * Renders one assistant/user message in the Trading Assistant chat.
 *
 * - User messages: a simple right-aligned bubble.
 * - Assistant messages: markdown text, plus — when the message produced a
 *   market analysis (analysisId) — a rich, lazily-fetched analysis card
 *   (decision + trade plan + step-by-step reasoning + risks).
 */
export default function AssistantMessage({ message }) {
  const isUser = message.role === 'user';
  const analysisId = message.analysisId || message.analysisIds?.[0] || null;

  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showReasoning, setShowReasoning] = useState(true);

  useEffect(() => {
    if (!analysisId || isUser) return;
    setLoading(true);
    analysisApi
      .get(analysisId)
      .then(({ data }) => setAnalysis(data.data.analysis))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [analysisId, isUser]);

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-brand-600 px-4 py-2.5 text-sm text-white">
          {message.content}
        </div>
      </div>
    );
  }

  const reasoning = analysis?.report?.reasoning || [];
  const risks = analysis?.report?.risks || [];

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] space-y-3">
        {/* Text reply */}
        <div className="rounded-2xl bg-gray-100 px-4 py-3 text-sm dark:bg-gray-800">
          <Sparkles className="mb-1 mr-1 inline h-3.5 w-3.5 text-brand-400" />
          <div className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {renderMarkdown(message.content)}
          </div>

          {/* Data-source badge */}
          {message.dataSource && (
            <div className="mt-2">
              <Badge tone={message.isRealData ? 'green' : 'yellow'}>
                {message.isRealData ? (
                  <><Radio className="h-3 w-3" /> Temps réel · {message.dataSource}</>
                ) : (
                  <><FlaskConical className="h-3 w-3" /> Simulé · {message.dataSource}</>
                )}
              </Badge>
            </div>
          )}
        </div>

        {/* Rich analysis card */}
        {analysisId && (
          <div className="space-y-3">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Spinner /> Chargement de l'analyse…
              </div>
            )}
            {analysis && (
              <>
                <DecisionCard decision={analysis.decision} confidenceScore={analysis.confidenceScore} />
                <TradePlanCard tradePlan={analysis.tradePlan} decision={analysis.decision} />

                {/* Step-by-step reasoning */}
                {reasoning.length > 0 && (
                  <div className="card p-4">
                    <button
                      onClick={() => setShowReasoning((v) => !v)}
                      className="flex w-full items-center justify-between font-semibold"
                    >
                      <span className="flex items-center gap-2">
                        <ListChecks className="h-4 w-4 text-brand-500" /> Raisonnement étape par étape
                      </span>
                      <ChevronDown className={`h-4 w-4 transition ${showReasoning ? 'rotate-180' : ''}`} />
                    </button>
                    {showReasoning && (
                      <ol className="mt-3 space-y-2">
                        {reasoning.map((step, i) => (
                          <li key={i} className="flex gap-2 text-sm text-gray-600 dark:text-gray-300">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
                              {i + 1}
                            </span>
                            <span>{step.replace(/^Étape \d+\s*—\s*/, '')}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}

                {/* Risks */}
                {risks.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-950/20">
                    <div className="mb-2 flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-300">
                      <ShieldAlert className="h-4 w-4" /> Risques
                    </div>
                    <ul className="space-y-1 text-sm text-amber-800/90 dark:text-amber-200/80">
                      {risks.map((r, i) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
