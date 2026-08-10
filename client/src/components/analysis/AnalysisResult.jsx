import { Download, FileText } from 'lucide-react';
import DecisionCard from './DecisionCard.jsx';
import TradePlanCard from './TradePlanCard.jsx';
import TechnicalAnalysis from './TechnicalAnalysis.jsx';
import DetailedReport from './DetailedReport.jsx';
import AnnotatedChart from './AnnotatedChart.jsx';
import LiveChart from './LiveChart.jsx';
import FeedbackButtons from './FeedbackButtons.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import { marketLabel, formatPrice, formatDateTime } from '../../utils/format.js';

/**
 * Full analysis result view, reused by the Scanner (post-scan) and the
 * AnalysisDetail history page. `onExportPdf` is optional. `market` is the live
 * snapshot returned by the scan (candles + quote); it is not persisted on the
 * Analysis, so history views pass none and the live chart self-fetches from the
 * symbol/timeframe instead.
 */
export default function AnalysisResult({ analysis, market, onExportPdf, exporting }) {
  if (!analysis) return null;

  const hasAnnotations = Array.isArray(analysis.annotations) && analysis.annotations.length > 0;
  // Show the live chart whenever we can identify the instrument (either from the
  // scan's snapshot or the analysis symbol — LiveChart will fetch on its own).
  const canShowLive = Boolean(market?.candles?.length || (analysis.symbol && analysis.symbol !== 'Unknown'));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold">{analysis.symbol}</h2>
            <Badge tone="purple">{marketLabel(analysis.market)}</Badge>
            <Badge tone="gray">{analysis.timeframe}</Badge>
            {analysis.visionProvider && (
              <Badge tone="blue">CV · {analysis.visionProvider.replace('-vision', '')}</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {analysis.broker && analysis.broker !== 'Unknown' ? `${analysis.broker} · ` : ''}
            Price: {formatPrice(analysis.currentPrice)}
            {analysis.createdAt ? ` · ${formatDateTime(analysis.createdAt)}` : ''}
          </p>
        </div>
        {onExportPdf && (
          <Button variant="secondary" onClick={onExportPdf} loading={exporting}>
            <Download className="h-4 w-4" /> Export PDF
          </Button>
        )}
      </div>

      {/* Annotated chart (CV overlay) full-width when available. */}
      {analysis.imageUrl && hasAnnotations && (
        <AnnotatedChart
          imageUrl={analysis.imageUrl}
          annotations={analysis.annotations}
          symbol={analysis.symbol}
        />
      )}

      {/* Real-time chart of the detected pair + timeframe, with the trade-plan
          levels drawn on the live price. */}
      {canShowLive && (
        <LiveChart
          market={market}
          symbol={analysis.symbol}
          timeframe={analysis.timeframe}
          tradePlan={analysis.tradePlan}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-6">
          <DecisionCard
            decision={analysis.decision}
            confidenceScore={analysis.confidenceScore}
            confidenceLabel={analysis.confidenceLabel}
          />
          {/* Fallback raw image for legacy analyses without annotations. */}
          {analysis.imageUrl && !hasAnnotations && (
            <div className="card overflow-hidden">
              <img src={analysis.imageUrl} alt={`${analysis.symbol} chart`} className="w-full" />
            </div>
          )}
        </div>
        <div className="lg:col-span-2">
          <TradePlanCard tradePlan={analysis.tradePlan} decision={analysis.decision} />
        </div>
      </div>

      <TechnicalAnalysis ta={analysis.technicalAnalysis} />
      <DetailedReport report={analysis.report} />

      {/* Quality feedback (persisted analyses only). */}
      {(analysis._id || analysis.id) && (
        <div className="card flex items-center justify-center p-4">
          <FeedbackButtons
            analysisId={analysis._id || analysis.id}
            initialRating={analysis.feedback?.rating || null}
          />
        </div>
      )}

      <p className="flex items-center justify-center gap-2 text-center text-xs text-gray-400">
        <FileText className="h-3.5 w-3.5" />
        AI-generated analysis for educational purposes only. Not financial advice.
      </p>
    </div>
  );
}
