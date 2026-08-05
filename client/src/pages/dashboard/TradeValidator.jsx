import { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Shield, UploadCloud, X, ScanLine, Image as ImageIcon, SlidersHorizontal } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import TradeValidationResult from '../../components/analysis/TradeValidationResult.jsx';
import EmailVerification from '../../components/auth/EmailVerification.jsx';
import { tradeValidatorApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

const ALLOWED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024;

/**
 * A single labeled input. Declared at module scope (not inside the page
 * component) so React keeps it mounted across renders — otherwise the field
 * loses focus on every keystroke.
 */
function InputField({ label, name, type = 'text', required, value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(name, e.target.value)}
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
      />
    </div>
  );
}

/** Trade Validator: screenshot or parameters mode. */
export default function TradeValidator() {
  const { user, refreshUser, requireEmailVerification } = useAuth();
  const needsVerification = requireEmailVerification && !user?.isVerified;
  const [mode, setMode] = useState('screenshot'); // 'screenshot' | 'parameters'
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [params, setParams] = useState({
    symbol: 'EURUSD', timeframe: 'H1', entry: '', stopLoss: '', takeProfit1: '', takeProfit2: '', strategy: '', riskPercent: '', accountBalance: '',
  });
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const setChosenFile = useCallback((f) => {
    if (!f) return;
    if (!ALLOWED.includes(f.type)) { toast.error('Format non supporté. PNG, JPEG, WEBP.'); return; }
    if (f.size > MAX_SIZE) { toast.error('Fichier trop volumineux. Max 10 MB.'); return; }
    setFile(f);
    setResult(null);
    setPreview(URL.createObjectURL(f));
  }, []);

  const clearAll = () => { setFile(null); setPreview(null); setResult(null); };

  const setParam = (key, value) => setParams((p) => ({ ...p, [key]: value }));
  const field = (label, name, opts = {}) => (
    <InputField label={label} name={name} value={params[name]} onChange={setParam} {...opts} />
  );

  const validate = async () => {
    if (needsVerification) { toast.error("Veuillez vérifier votre email avant de valider un trade."); return; }
    if (mode === 'screenshot' && !file) { toast.error('Ajoutez une capture avant de valider.'); return; }
    if (mode === 'parameters' && (!params.entry || !params.stopLoss)) { toast.error('Entry et Stop Loss sont obligatoires.'); return; }

    setValidating(true);
    try {
      if (mode === 'screenshot') {
        const form = new FormData();
        form.append('image', file);
        form.append('symbol', params.symbol);
        form.append('timeframe', params.timeframe);
        const { data } = await tradeValidatorApi.validate(form);
        setResult(data.data.validation);
      } else {
        const { data } = await tradeValidatorApi.validate(params);
        setResult(data.data.validation);
      }
      await refreshUser();
      toast.success('Validation terminée !');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Shield className="h-6 w-6 text-brand-500" /> Trade Validator
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          L'IA vérifie votre plan de trade : gestion du risque, placement SL/TP, ratio R:R, et recommande VALIDER, ATTENDRE ou REFUSER.
        </p>
      </div>

      {needsVerification && (
        <EmailVerification
          onVerified={refreshUser}
          description={
            <>
              Vérifiez votre email pour utiliser le Trade Validator. Un code à 6 chiffres a été
              envoyé à votre adresse — collez-le ci-dessous puis cliquez sur « Vérifier l'email ».
            </>
          }
        />
      )}

      {!needsVerification && !result && (
        <>
          {/* Mode switch */}
          <div className="card p-4">
            <div className="flex gap-2">
              {[
                { value: 'screenshot', label: 'Capture d\'écran', icon: ImageIcon },
                { value: 'parameters', label: 'Paramètres manuels', icon: SlidersHorizontal },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setMode(opt.value); setResult(null); }}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition ${
                    mode === opt.value
                      ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/25'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  <opt.icon className="h-4 w-4" /> {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Screenshot upload */}
          {mode === 'screenshot' && (
            <div className="card p-6">
              <p className="text-sm font-semibold">Ajoutez le graphique avec vos niveaux (entry, SL, TP)</p>
              {!preview ? (
                <div
                  onClick={() => inputRef.current?.click()}
                  className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 p-12 text-center hover:border-brand-400 dark:border-gray-700"
                >
                  <UploadCloud className="h-10 w-10 text-gray-400" />
                  <p className="mt-3 font-semibold">Déposez ou cliquez pour ajouter</p>
                  <p className="mt-1 text-sm text-gray-500">PNG · JPEG · WEBP, max 10 MB</p>
                  <input ref={inputRef} type="file" accept={ALLOWED.join(',')} className="hidden" onChange={(e) => setChosenFile(e.target.files?.[0])} />
                </div>
              ) : (
                <div className="mt-4">
                  <div className="relative overflow-hidden rounded-2xl border">
                    <img src={preview} alt="Preview" className="max-h-80 w-full object-contain bg-gray-100 dark:bg-gray-900" />
                    <button onClick={() => { setFile(null); setPreview(null); }} className="absolute right-3 top-3 rounded-lg bg-black/60 p-1.5 text-white hover:bg-black/80"><X className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Parameters form */}
          {mode === 'parameters' && (
            <div className="card p-6">
              <p className="text-sm font-semibold">Saisissez les paramètres de votre trade</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {field('Symbole', 'symbol', { required: true })}
                {field('Timeframe', 'timeframe', { required: true })}
                {field('Entry', 'entry', { type: 'number', required: true })}
                {field('Stop Loss', 'stopLoss', { type: 'number', required: true })}
                {field('Take Profit 1', 'takeProfit1', { type: 'number' })}
                {field('Take Profit 2', 'takeProfit2', { type: 'number' })}
                {field('Stratégie', 'strategy')}
                {field('% Risque', 'riskPercent', { type: 'number' })}
                {field('Balance ($)', 'accountBalance', { type: 'number' })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={validate} loading={validating} className="flex-1 py-3 text-base">
              <ScanLine className="h-5 w-5" /> {validating ? 'Analyse du trade…' : 'Valider ce trade'}
            </Button>
            <Button variant="secondary" onClick={clearAll} disabled={validating}>Annuler</Button>
          </div>
        </>
      )}

      {result && (
        <div className="space-y-4">
          <Button variant="secondary" onClick={clearAll}>← Valider un autre trade</Button>
          <TradeValidationResult validation={result} />
        </div>
      )}
    </div>
  );
}
