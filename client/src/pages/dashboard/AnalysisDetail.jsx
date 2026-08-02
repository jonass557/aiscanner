import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import Spinner from '../../components/ui/Spinner.jsx';
import AnalysisResult from '../../components/analysis/AnalysisResult.jsx';
import { analysisApi, downloadBlob } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';

/** Full detail view for a single saved analysis. */
export default function AnalysisDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    analysisApi
      .get(id)
      .then(({ data }) => setAnalysis(data.data.analysis))
      .catch((err) => {
        toast.error(getErrorMessage(err));
        navigate('/dashboard/history');
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const exportPdf = async () => {
    setExporting(true);
    try {
      const { data } = await analysisApi.exportPdf(id);
      downloadBlob(data, `analysis-${analysis.symbol}.pdf`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <Spinner label="Loading analysis…" />;
  if (!analysis) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link to="/dashboard/history" className="btn-ghost inline-flex">
        <ArrowLeft className="h-4 w-4" /> Back to history
      </Link>
      <AnalysisResult analysis={analysis} onExportPdf={exportPdf} exporting={exporting} />
    </div>
  );
}
