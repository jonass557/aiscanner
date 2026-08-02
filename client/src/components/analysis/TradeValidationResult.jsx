import { motion } from 'framer-motion';
import {
  CheckCircle2, Clock, XCircle, AlertTriangle, TrendingUp, Shield, Target, FileText,
} from 'lucide-react';
import Badge from '../ui/Badge.jsx';
import { formatPrice } from '../../utils/format.js';

const DECISION_META = {
  VALIDATE: { label: 'VALIDER', icon: CheckCircle2, bg: 'from-green-500 to-emerald-600', tone: 'green', text: 'Ce trade respecte les critères de gestion du risque.' },
  WAIT: { label: 'ATTENDRE', icon: Clock, bg: 'from-amber-500 to-orange-600', tone: 'yellow', text: 'Attendez une meilleure confirmation avant d\'entrer.' },
  REJECT: { label: 'REFUSER', icon: XCircle, bg: 'from-red-500 to-rose-600', tone: 'red', text: 'Ce trade ne respecte pas les critères — à éviter tel quel.' },
};

const SEVERITY_TONE = { high: 'red', medium: 'yellow', low: 'gray' };

/** Renders a completed AI Trade Validator verdict. */
export default function TradeValidationResult({ validation }) {
  if (!validation) return null;
  const meta = DECISION_META[validation.decision] || DECISION_META.WAIT;
  const DecisionIcon = meta.icon;

  return (
    <div className="space-y-6">
      {/* Verdict banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${meta.bg} p-6 text-white shadow-xl`}
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">Verdict de l'IA</p>
            <div className="mt-1 flex items-center gap-2">
              <DecisionIcon className="h-8 w-8" />
              <span className="text-4xl font-extrabold tracking-tight">{meta.label}</span>
            </div>
            <p className="mt-1 text-sm text-white/80">{meta.text}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-white/80">Confiance</p>
            <p className="text-4xl font-extrabold">{validation.confidenceScore}%</p>
            {validation.riskRewardRatio && (
              <p className="mt-1 text-sm text-white/80">R:R {validation.riskRewardRatio}</p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Header meta */}
      <div className="card flex flex-wrap items-center gap-2 p-4">
        <span className="font-bold">{validation.symbol}</span>
        <Badge tone="gray">{validation.timeframe}</Badge>
        <Badge tone="purple">{validation.inputMode === 'screenshot' ? 'Capture' : 'Paramètres'}</Badge>
        <span className="ml-auto flex items-center gap-1 text-sm text-gray-500">
          <Shield className="h-4 w-4" /> Risque : {validation.riskScore}/100
        </span>
      </div>

      {/* SL / TP / Risk management */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className={`card border-l-4 p-5 ${validation.stopLossAnalysis?.isValid ? 'border-l-green-500' : 'border-l-red-500'}`}>
          <h3 className="flex items-center gap-2 font-semibold">
            <Shield className="h-5 w-5 text-brand-500" /> Stop Loss
            <Badge tone={validation.stopLossAnalysis?.isValid ? 'green' : 'red'}>
              {validation.stopLossAnalysis?.isValid ? 'Valide' : 'À revoir'}
            </Badge>
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{validation.stopLossAnalysis?.placement}</p>
          <p className="mt-2 text-sm text-gray-500">{validation.stopLossAnalysis?.reasoning}</p>
          {validation.stopLossAnalysis?.suggestions?.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-gray-500">
              {validation.stopLossAnalysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          )}
        </div>

        <div className={`card border-l-4 p-5 ${validation.takeProfitAnalysis?.isValid ? 'border-l-green-500' : 'border-l-amber-500'}`}>
          <h3 className="flex items-center gap-2 font-semibold">
            <Target className="h-5 w-5 text-brand-500" /> Take Profit
            <Badge tone={validation.takeProfitAnalysis?.isValid ? 'green' : 'yellow'}>
              {validation.takeProfitAnalysis?.isValid ? 'Réaliste' : 'À ajuster'}
            </Badge>
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{validation.takeProfitAnalysis?.targeting}</p>
          <p className="mt-2 text-sm text-gray-500">{validation.takeProfitAnalysis?.reasoning}</p>
          {validation.takeProfitAnalysis?.suggestions?.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-gray-500">
              {validation.takeProfitAnalysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <TrendingUp className="h-5 w-5 text-brand-500" /> Gestion du risque
          </h3>
          <div className="mt-3 space-y-2 text-sm">
            {[
              ['Taille de position', validation.riskManagementCheck?.positionSizeAcceptable],
              ['% de risque', validation.riskManagementCheck?.riskPercentAcceptable],
              ['Ratio R:R', validation.riskManagementCheck?.rrAcceptable],
            ].map(([label, ok]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-gray-500">{label}</span>
                {ok ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">{validation.riskManagementCheck?.reasoning}</p>
        </div>
      </div>

      {/* Strengths & weaknesses */}
      <div className="grid gap-6 lg:grid-cols-2">
        {validation.strengths?.length > 0 && (
          <div className="card p-5">
            <h3 className="flex items-center gap-2 font-semibold text-green-600">
              <CheckCircle2 className="h-5 w-5" /> Points forts
            </h3>
            <ul className="mt-3 space-y-2">
              {validation.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" /> {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {validation.weaknesses?.length > 0 && (
          <div className="card p-5">
            <h3 className="flex items-center gap-2 font-semibold text-red-600">
              <AlertTriangle className="h-5 w-5" /> Faiblesses
            </h3>
            <ul className="mt-3 space-y-2">
              {validation.weaknesses.map((w, i) => (
                <li key={i} className="flex items-start justify-between gap-2 text-sm">
                  <span className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> {w.description}
                  </span>
                  <Badge tone={SEVERITY_TONE[w.severity]}>{w.severity}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Recommendations */}
      {validation.recommendations?.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold">Recommandations</h3>
          <ul className="mt-3 space-y-2">
            {validation.recommendations.map((r, i) => (
              <li key={i} className="flex items-start justify-between gap-2 text-sm">
                <span>{r.action}</span>
                <Badge tone={SEVERITY_TONE[r.priority]}>{r.priority}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary */}
      {validation.summary && (
        <div className="card p-6">
          <h3 className="font-semibold">Résumé</h3>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{validation.summary}</p>
        </div>
      )}

      <p className="flex items-center justify-center gap-2 text-center text-xs text-gray-400">
        <FileText className="h-3.5 w-3.5" />
        Analyse IA à but éducatif uniquement. Ce n'est pas un conseil financier.
      </p>
    </div>
  );
}
