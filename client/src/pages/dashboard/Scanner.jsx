import { useState, useRef, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { UploadCloud, Image as ImageIcon, X, ScanLine, Clipboard } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import AnalysisResult from '../../components/analysis/AnalysisResult.jsx';
import EmailVerification from '../../components/auth/EmailVerification.jsx';
import { scanApi, analysisApi, downloadBlob } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

const ALLOWED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024;

/** The AI Scanner: upload (drag/drop/paste/select), preview, scan, show result. */
export default function Scanner() {
  const { user, refreshUser } = useAuth();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [exporting, setExporting] = useState(false);
  const inputRef = useRef(null);

  const setChosenFile = useCallback((f) => {
    if (!f) return;
    if (!ALLOWED.includes(f.type)) {
      toast.error('Unsupported format. Use PNG, JPG, JPEG, or WEBP.');
      return;
    }
    if (f.size > MAX_SIZE) {
      toast.error('File too large. Max 10 MB.');
      return;
    }
    setFile(f);
    setResult(null);
    setPreview(URL.createObjectURL(f));
  }, []);

  // Paste-from-clipboard support.
  useEffect(() => {
    const onPaste = (e) => {
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
      if (item) setChosenFile(item.getAsFile());
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [setChosenFile]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    setChosenFile(e.dataTransfer.files?.[0]);
  };

  const clear = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
  };

  const scan = async () => {
    if (!file) return;
    if (!user?.isVerified) {
      toast.error("Veuillez vérifier votre email avant de scanner.");
      return;
    }
    setScanning(true);
    const form = new FormData();
    form.append('image', file);
    try {
      const { data } = await scanApi.scan(form);
      setResult(data.data.analysis);
      await refreshUser();
      toast.success('Analysis complete!');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setScanning(false);
    }
  };

  const exportPdf = async () => {
    if (!result?._id) return;
    setExporting(true);
    try {
      const { data } = await analysisApi.exportPdf(result._id);
      downloadBlob(data, `analysis-${result.symbol}.pdf`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Scanner</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload a chart screenshot and get a complete institutional-grade analysis.
        </p>
      </div>

      {!user?.isVerified && (
        <EmailVerification
          onVerified={refreshUser}
          description={
            <>
              Vérifiez votre email pour débloquer le scan. Un code à 6 chiffres a été envoyé à votre
              adresse — collez-le ci-dessous puis cliquez sur « Vérifier l'email ».
            </>
          }
        />
      )}

      {user?.isVerified && !result && (
        <div className="card p-6">
          {!preview ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center transition ${
                dragging
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30'
                  : 'border-gray-300 hover:border-brand-400 dark:border-gray-700'
              }`}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white">
                <UploadCloud className="h-8 w-8" />
              </div>
              <p className="mt-4 font-semibold">Drag & drop your chart here</p>
              <p className="mt-1 text-sm text-gray-500">or click to browse · paste from clipboard</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-gray-400">
                <span className="flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" /> PNG · JPG · JPEG · WEBP</span>
                <span className="flex items-center gap-1"><Clipboard className="h-3.5 w-3.5" /> Ctrl+V to paste</span>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept={ALLOWED.join(',')}
                className="hidden"
                onChange={(e) => setChosenFile(e.target.files?.[0])}
              />
            </div>
          ) : (
            <div>
              <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
                <img src={preview} alt="Chart preview" className="max-h-[420px] w-full object-contain bg-gray-100 dark:bg-gray-900" />
                <button
                  onClick={clear}
                  className="absolute right-3 top-3 rounded-lg bg-black/60 p-1.5 text-white hover:bg-black/80"
                  aria-label="Remove image"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Button onClick={scan} loading={scanning} className="flex-1 py-3 text-base">
                  <ScanLine className="h-5 w-5" /> {scanning ? 'Analyzing…' : 'Scan chart'}
                </Button>
                <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={scanning}>
                  Change image
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  accept={ALLOWED.join(',')}
                  className="hidden"
                  onChange={(e) => setChosenFile(e.target.files?.[0])}
                />
              </div>
              {scanning && (
                <p className="mt-3 text-center text-sm text-gray-500">
                  The AI is reading market structure, liquidity, and confluences… this can take a few seconds.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <Button variant="secondary" onClick={clear}>
            ← Scan another chart
          </Button>
          <AnalysisResult analysis={result} onExportPdf={exportPdf} exporting={exporting} />
        </div>
      )}
    </div>
  );
}
