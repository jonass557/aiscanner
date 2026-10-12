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
  const { user, refreshUser, requireEmailVerification } = useAuth();
  const needsVerification = requireEmailVerification && !user?.isVerified;
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [market, setMarket] = useState(null);
  const [customStrategy, setCustomStrategy] = useState('');
  const [saveStrategy, setSaveStrategy] = useState(false);
  const [showStrategyBox, setShowStrategyBox] = useState(false);
  const inputRef = useRef(null);

  // Prepopulate customStrategy from user preferences if available
  useEffect(() => {
    if (user?.preferences?.customStrategy) {
      setCustomStrategy(user.preferences.customStrategy);
      setShowStrategyBox(true);
    }
  }, [user]);

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
    setMarket(null);
  };

  const scan = async () => {
    if (!file) return;
    if (needsVerification) {
      toast.error("Veuillez vérifier votre email avant de scanner.");
      return;
    }
    setScanning(true);
    const form = new FormData();
    form.append('image', file);
    if (customStrategy.trim()) {
      form.append('strategy', customStrategy.trim());
    }
    if (saveStrategy) {
      form.append('saveStrategy', 'true');
    }
    try {
      const { data } = await scanApi.scan(form);
      setResult(data.data.analysis);
      setMarket(data.data.market || null);
      await refreshUser();
      toast.success('Analyse IA terminée avec succès !');
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

      {needsVerification && (
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

      {!needsVerification && !result && (
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
              {/* Custom Strategy Input Panel */}
              <div className="mt-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/20 text-brand-600 dark:text-brand-400 text-xs font-bold">
                      ★
                    </span>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Stratégie de trading personnalisée (Optionnelle)
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowStrategyBox(!showStrategyBox)}
                    className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    {showStrategyBox ? 'Masquer' : customStrategy ? 'Modifier la stratégie' : '+ Définir une stratégie'}
                  </button>
                </div>

                {showStrategyBox && (
                  <div className="mt-3 space-y-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Indiquez vos règles précises (ex: <em>"Achat uniquement sur FVG 15M après balayage des plus bas de Londres, confirmation cassure de structure BOS, R:R minimum 1:3"</em>). L'IA adaptera l'analyse et vérifiera le respect de votre système.
                    </p>
                    <textarea
                      rows={3}
                      value={customStrategy}
                      onChange={(e) => setCustomStrategy(e.target.value)}
                      placeholder="Exemple : Stratégie SMC / ICT - Entrée après balayage de liquidité (Sweep), mitigation d'Order Block M15, cibler le prochain Equal High..."
                      className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={saveStrategy}
                        onChange={(e) => setSaveStrategy(e.target.checked)}
                        className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span>Enregistrer cette stratégie dans mon profil pour mes prochains scans</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Button onClick={scan} loading={scanning} className="flex-1 py-3 text-base">
                  <ScanLine className="h-5 w-5" /> {scanning ? 'Analyse en cours…' : 'Lancer le scan IA'}
                </Button>
                <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={scanning}>
                  Changer d'image
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
          <AnalysisResult analysis={result} market={market} onExportPdf={exportPdf} exporting={exporting} />
        </div>
      )}
    </div>
  );
}
