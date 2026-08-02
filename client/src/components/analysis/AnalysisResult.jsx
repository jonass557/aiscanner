import { Download, FileText } from 'lucide-react';
import DecisionCard from './DecisionCard.jsx';
import TradePlanCard from './TradePlanCard.jsx';
import TechnicalAnalysis from './TechnicalAnalysis.jsx';
import DetailedReport from './DetailedReport.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import { marketLabel, formatPrice, formatDateTime } from '../../utils/format.js';

/**
 * Full analysis result view, reused by the Scanner (post-scan) and the
 * AnalysisDetail history page. `onExportPdf` is optional.
 */
export default function AnalysisResult({ analysis, onExportPdf, exporting }) {
  if (!analysis) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold">{analysis.symbol}</h2>
            <Badge tone="purple">{marketLabel(analysis.market)}</Badge>
            <Badge tone="gray">{analysis.timeframe}</Badge>
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

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-6">
          <DecisionCard decision={analysis.decision} confidenceScore={analysis.confidenceScore} />
          {analysis.imageUrl && (
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

      <p className="flex items-center justify-center gap-2 text-center text-xs text-gray-400">
        <FileText className="h-3.5 w-3.5" />
        AI-generated analysis for educational purposes only. Not financial advice.
      </p>
    </div>
  );
}
