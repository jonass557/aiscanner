import { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Layers, UploadCloud, X, ScanLine } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import MultiTimeframeResult from '../../components/analysis/MultiTimeframeResult.jsx';
import EmailVerification from '../../components/auth/EmailVerification.jsx';
import { multiTimeframeApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

const ALLOWED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024;

// Ordered low -> high; the backend re-sorts, but this drives the UI order.
const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN'];

/**
 * Multi-Timeframe Analyzer: pick 2-6 timeframes, attach a chart to each,
 * and get a top-down alignment/confluence verdict.
 */
export default function MultiTimeframe() {
  const { user, refreshUser } = useAuth();
  // Map of timeframe -> { file, preview }
  const [charts, setCharts] = useState({});
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const inputRefs = useRef({});

  const selected = Object.keys(charts);

  const toggleTimeframe = (tf) => {
    setCharts((prev) => {
      const next = { ...prev };
      if (next[tf]) {
        delete next[tf];
      } else {
        if (Object.keys(next).length >= 6) {
          toast.error('You can compare at most 6 timeframes.');
          return prev;
        }
        next[tf] = { file: null, preview: null };
      }
      return next;
    });
  };

  const setFileFor = useCallback((tf, f) => {
    if (!f) return;
    if (!ALLOWED.includes(f.type)) {
      toast.error('Unsupported format. Use PNG, JPG, JPEG, or WEBP.');
      return;
    }
    if (f.size > MAX_SIZE) {
      toast.error('File too large. Max 10 MB.');
      return;
    }
    setCharts((prev) => ({ ...prev, [tf]: { file: f, preview: URL.createObjectURL(f) } }));
  }, []);

  const clearAll = () => {
    setCharts({});
    setResult(null);
  };

  const readyCount = selected.filter((tf) => charts[tf]?.file).length;

  const scan = async () => {
    if (!user?.isVerified) {
      toast.error("Veuillez vérifier votre email avant de scanner.");
      return;
    }
    if (readyCount < 2) {
      toast.error('Please attach a chart to at least 2 timeframes.');
      return;
    }
    if (readyCount !== selected.length) {
      toast.error('Every selected timeframe needs a chart (or deselect it).');
      return;
    }

    setScanning(true);
    const form = new FormData();
    // Keep images and timeframes index-aligned.
    const ordered = TIMEFRAMES.filter((tf) => charts[tf]?.file);
    ordered.forEach((tf) => {
      form.append('images', charts[tf].file);
      form.append('timeframes', tf);
    });

    try {
      const { data } = await multiTimeframeApi.scan(form);
      setResult(data.data.analysis);
      await refreshUser();
      toast.success('Multi-timeframe analysis complete!');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Layers className="h-6 w-6 text-brand-500" /> Multi-Timeframe Analyzer
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload the same instrument across several timeframes. The AI checks trend alignment,
          detects conflicts, and confirms whether the signal holds top-down.
        </p>
      </div>

      {!user?.isVerified && (
        <EmailVerification
          onVerified={refreshUser}
          description={
            <>
              Vérifiez votre email pour utiliser l'analyse multi-timeframe. Un code à 6 chiffres a
              été envoyé à votre adresse — collez-le ci-dessous puis cliquez sur « Vérifier l'email ».
            </>
          }
        />
      )}

      {user?.isVerified && !result && (
        <>
          {/* Timeframe selector */}
          <div className="card p-6">
            <p className="text-sm font-semibold">1. Select timeframes to compare (2-6)</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {TIMEFRAMES.map((tf) => {
                const active = Boolean(charts[tf]);
                return (
                  <button
                    key={tf}
                    onClick={() => toggleTimeframe(tf)}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                      active
                        ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/25'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    {tf}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Upload per selected timeframe */}
          {selected.length > 0 && (
            <div className="card p-6">
              <p className="text-sm font-semibold">2. Attach a chart to each timeframe</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {TIMEFRAMES.filter((tf) => charts[tf]).map((tf) => {
                  const entry = charts[tf];
                  return (
                    <div key={tf} className="rounded-2xl border border-gray-200 p-3 dark:border-gray-800">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-bold">{tf}</span>
                        <button
                          onClick={() => toggleTimeframe(tf)}
                          className="text-gray-400 hover:text-red-500"
                          aria-label={`Remove ${tf}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {entry.preview ? (
                        <div className="relative">
                          <img
                            src={entry.preview}
                            alt={`${tf} chart`}
                            className="h-28 w-full rounded-lg bg-gray-100 object-cover dark:bg-gray-900"
                          />
                          <button
                            onClick={() => inputRefs.current[tf]?.click()}
                            className="mt-2 w-full text-xs text-brand-600 hover:underline"
                          >
                            Change image
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => inputRefs.current[tf]?.click()}
                          className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-center hover:border-brand-400 dark:border-gray-700"
                        >
                          <UploadCloud className="h-6 w-6 text-gray-400" />
                          <span className="mt-1 text-xs text-gray-500">Upload {tf} chart</span>
                        </div>
                      )}
                      <input
                        ref={(el) => (inputRefs.current[tf] = el)}
                        type="file"
                        accept={ALLOWED.join(',')}
                        className="hidden"
                        onChange={(e) => setFileFor(tf, e.target.files?.[0])}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button onClick={scan} loading={scanning} className="flex-1 py-3 text-base">
                  <ScanLine className="h-5 w-5" />
                  {scanning ? 'Analyzing all timeframes…' : `Analyze ${readyCount} timeframe${readyCount === 1 ? '' : 's'}`}
                </Button>
                <Button variant="secondary" onClick={clearAll} disabled={scanning}>
                  Reset
                </Button>
              </div>
              {scanning && (
                <p className="mt-3 text-center text-sm text-gray-500">
                  The AI is reading each timeframe and checking top-down alignment… this can take a few seconds.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {result && (
        <div className="space-y-4">
          <Button variant="secondary" onClick={clearAll}>
            ← New multi-timeframe analysis
          </Button>
          <MultiTimeframeResult analysis={result} />
        </div>
      )}
    </div>
  );
}
