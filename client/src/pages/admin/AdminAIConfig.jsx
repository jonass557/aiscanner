import { useEffect, useState } from 'react';
import { Cpu, CheckCircle2, XCircle, Info, Save, PlugZap, Eye, Sparkles, Key, Zap } from 'lucide-react';
import Badge from '../../components/ui/Badge.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import { adminApi } from '../../services/endpoints.js';

/**
 * Configuration IA avancée et gestion dynamique des modèles Gemini & Providers.
 * Permet à l'administrateur de modifier la clé Gemini et de basculer
 * instantanément entre les derniers modèles (gemini-3.8-flash, gemini-3.5-flash, etc.).
 */

const GEMINI_MODELS = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (Recommandé - Ultra Rapide & Vision 2026)', badge: 'Plus Rapide' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (Haute Confluence & Vitesse)', badge: 'Performant' },
  { id: 'gemini-flash-latest', label: 'Gemini Flash Latest (Stable général)', badge: 'Stable' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', badge: 'Standard' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Raisonnement approfondi)', badge: 'Avancé' },
];

const FIELD_META = {
  'ai.provider': { label: 'Fournisseur de raisonnement actif', hint: 'gemini | openai | claude | nvidia' },
  'vision.provider': { label: 'Fournisseur de vision actif', hint: 'gemini | openai | claude | nvidia | mock' },
  'ai.gemini.apiKey': { label: 'Clé API Google Gemini', secret: true },
  'ai.gemini.model': { label: 'Modèle Gemini actif', hint: 'gemini-3.8-flash' },
  'ai.openai.apiKey': { label: 'Clé API OpenAI', secret: true },
  'ai.openai.model': { label: 'Modèle OpenAI', hint: 'gpt-4o' },
  'ai.claude.apiKey': { label: 'Clé API Anthropic Claude', secret: true },
  'ai.claude.model': { label: 'Modèle Claude', hint: 'claude-3-opus-20240229' },
  'ai.nvidia.apiKey': { label: 'Clé API NVIDIA NIM', secret: true },
  'ai.nvidia.model': { label: 'Modèle NVIDIA', hint: 'meta/llama-3.2-90b-vision-instruct' },
  'ai.nvidia.baseUrl': { label: 'URL de base NVIDIA', hint: 'https://integrate.api.nvidia.com/v1' },
  'marketData.twelveData.apiKey': { label: 'Clé API TwelveData (Flux Forex / Or / Indices temps réel)', secret: true },
  'payments.provider': { label: 'Fournisseur de paiement actif', hint: 'sebpay | demo' },
  'payments.sebpay.publicKey': { label: 'Clé publique SebPay', secret: true },
  'payments.sebpay.secretKey': { label: 'Clé secrète SebPay', secret: true },
  'payments.sebpay.baseUrl': { label: 'URL de base SebPay', hint: 'https://new.sebpay.bj/api' },
  'payments.sebpay.callbackUrl': { label: 'URL de callback SebPay' },
  'features.requireEmailVerification': {
    label: 'Vérification email obligatoire',
    hint: "Exige un code OTP par email avant de scanner. Désactivé, l'accès est immédiat.",
    toggle: true,
  },
};

const CATEGORY_TITLES = {
  ai: 'Fournisseurs IA (Gemini · OpenAI · Claude · NVIDIA)',
  vision: 'Moteur de Vision par Ordinateur (Graphiques)',
  payments: 'Paiements & Abonnements (SebPay)',
  features: 'Fonctionnalités & Sécurité',
};

const TESTABLE = ['gemini', 'openai', 'claude', 'nvidia'];

export default function AdminAIConfig() {
  const [aiConfig, setAiConfig] = useState(null);
  const [groups, setGroups] = useState({});
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(null);
  const [tests, setTests] = useState({});
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  const load = async () => {
    const [{ data: cfg }, { data: st }] = await Promise.all([adminApi.aiConfig(), adminApi.settings()]);
    setAiConfig(cfg.data);
    const grouped = st.data.settings;
    setGroups(grouped);
    const seed = {};
    Object.values(grouped).flat().forEach((f) => {
      seed[f.key] = f.secret ? '' : f.value ?? '';
    });
    setValues(seed);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const onChange = (key, val) => setValues((v) => ({ ...v, [key]: val }));

  const save = async (customPayload = null) => {
    setSaving(true);
    setFlash(null);
    let payload = customPayload;
    if (!payload) {
      payload = [];
      Object.values(groups).flat().forEach((f) => {
        const val = values[f.key];
        if (f.secret) {
          if (val && val.trim()) payload.push({ key: f.key, value: val.trim() });
        } else {
          payload.push({ key: f.key, value: val ?? '' });
        }
      });
    }

    try {
      await adminApi.updateSettings(payload);
      setFlash({ tone: 'green', text: 'Paramètres enregistrés avec succès ! Modèles et clés mis à jour.' });
      await load();
    } catch (err) {
      setFlash({ tone: 'red', text: err.response?.data?.message || "Échec de l'enregistrement des paramètres." });
    } finally {
      setSaving(false);
    }
  };

  const activateGeminiGlobally = async () => {
    const payload = [
      { key: 'ai.provider', value: 'gemini' },
      { key: 'vision.provider', value: 'gemini' },
    ];
    if (values['ai.gemini.model']) {
      payload.push({ key: 'ai.gemini.model', value: values['ai.gemini.model'] });
    }
    if (values['ai.gemini.apiKey'] && values['ai.gemini.apiKey'].trim()) {
      payload.push({ key: 'ai.gemini.apiKey', value: values['ai.gemini.apiKey'].trim() });
    }
    await save(payload);
  };

  const runTest = async (provider) => {
    setTests((t) => ({ ...t, [provider]: { loading: true } }));
    try {
      const { data } = await adminApi.testProvider(provider);
      setTests((t) => ({ ...t, [provider]: { loading: false, ...data.data } }));
    } catch (err) {
      setTests((t) => ({
        ...t,
        [provider]: { loading: false, ok: false, message: err.response?.data?.message || 'Test échoué.' },
      }));
    }
  };

  if (loading) return <Spinner label="Chargement de la configuration IA…" />;

  const geminiConfigured = aiConfig?.providers?.gemini?.configured;
  const isGeminiActive = aiConfig?.activeProvider === 'gemini';

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Sparkles className="h-6 w-6 text-cyan-400" /> Centre de Contrôle IA &amp; Modèles Gemini
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Gérez vos clés API et sélectionnez les modèles Gemini les plus performants en temps réel sans redémarrage.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => save()} loading={saving} variant="primary" className="shadow-lg shadow-cyan-500/20">
            <Save className="h-4 w-4" /> Enregistrer les modifications
          </Button>
        </div>
      </div>

      {flash && (
        <div
          className={`flex items-center gap-3 rounded-xl p-4 text-sm font-medium ${
            flash.tone === 'green'
              ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border border-red-500/30 bg-red-500/10 text-red-400'
          }`}
        >
          {flash.tone === 'green' ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
          {flash.text}
        </div>
      )}

      {/* Carte spéciale : Configuration Google Gemini Ultra-Performant */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950/40 p-6 shadow-xl">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative z-10 space-y-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/40">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">Google Gemini (IA Principale Ultra-Rapide)</h2>
                  {geminiConfigured ? (
                    <Badge tone="green"><CheckCircle2 className="h-3.5 w-3.5" /> Clé Active</Badge>
                  ) : (
                    <Badge tone="yellow"><XCircle className="h-3.5 w-3.5" /> Clé manquante</Badge>
                  )}
                  {isGeminiActive && (
                    <span className="rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-xs font-semibold text-cyan-300 ring-1 ring-cyan-500/40">
                      ★ Fournisseur Actif
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Modèles multimodaux de dernière génération avec vision de graphiques trading et latence inférieure à 2 secondes.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                loading={tests['gemini']?.loading}
                onClick={() => runTest('gemini')}
                className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
              >
                <PlugZap className="h-4 w-4" /> Tester la Clé Gemini
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={saving}
                onClick={activateGeminiGlobally}
                className="bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-semibold"
              >
                Activer Gemini pour Tout le Site
              </Button>
            </div>
          </div>

          {tests['gemini'] && !tests['gemini'].loading && (
            <div
              className={`rounded-xl p-3 text-xs ${
                tests['gemini'].ok
                  ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border border-red-500/30 bg-red-500/10 text-red-300'
              }`}
            >
              {tests['gemini'].message}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Sélectionner le Modèle Gemini (Dernière Génération)
              </label>
              <select
                value={values['ai.gemini.model'] || 'gemini-3.8-flash'}
                onChange={(e) => onChange('ai.gemini.model', e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                {GEMINI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                <strong>gemini-3.8-flash</strong> est recommandé pour des analyses graphiques instantanées sans délai.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Modifier ou Remplacer la Clé API Gemini
              </label>
              <div className="relative">
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  value={values['ai.gemini.apiKey'] ?? ''}
                  onChange={(e) => onChange('ai.gemini.apiKey', e.target.value)}
                  placeholder={
                    aiConfig?.providers?.gemini?.keyPreview
                      ? `${aiConfig.providers.gemini.keyPreview} (Laissez vide pour conserver)`
                      : 'Collez votre clé API Gemini (commence par AIza... ou AQ...)'
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Obtenez une clé gratuitement sur <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-cyan-400 underline">aistudio.google.com</a>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Résumé des fournisseurs actifs */}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard icon={Cpu} label="Fournisseur Raisonnement Actif" value={aiConfig.activeProvider} />
        <SummaryCard icon={Eye} label="Fournisseur Vision Actif" value={aiConfig.activeVisionProvider} />
        <SummaryCard icon={PlugZap} label="Passerelle Paiements" value={aiConfig.activePaymentProvider} />
      </div>

      {/* Statut de tous les fournisseurs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Object.entries(aiConfig.providers).map(([name, p]) => {
          const test = tests[name];
          return (
            <div key={name} className="card p-5 border border-slate-800 bg-slate-900/70">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold capitalize text-white">{name}</h3>
                {p.configured ? (
                  <Badge tone="green"><CheckCircle2 className="h-3.5 w-3.5" /> Configuré</Badge>
                ) : (
                  <Badge tone="gray"><XCircle className="h-3.5 w-3.5" /> Non configuré</Badge>
                )}
              </div>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Modèle</dt>
                  <dd className="truncate font-mono text-xs text-cyan-300">{p.model || '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Clé</dt>
                  <dd className="font-mono text-xs text-slate-300">{p.keyPreview || '—'}</dd>
                </div>
              </dl>
              {TESTABLE.includes(name) && (
                <div className="mt-3">
                  <Button variant="secondary" className="w-full text-xs" loading={test?.loading} onClick={() => runTest(name)}>
                    <PlugZap className="h-3.5 w-3.5" /> Tester la connexion
                  </Button>
                  {test && !test.loading && (
                    <p className={`mt-2 text-xs ${test.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{test.message}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Paramètres éditables groupés */}
      {Object.entries(groups).map(([category, fields]) => (
        <div key={category} className="card p-6 border border-slate-800 bg-slate-900/60">
          <h2 className="mb-4 text-lg font-semibold text-white">{CATEGORY_TITLES[category] || category}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {fields.map((f) => {
              const meta = FIELD_META[f.key] || { label: f.key };
              if (meta.toggle) {
                const on = values[f.key] === true || values[f.key] === 'true';
                return (
                  <div key={f.key} className="md:col-span-2 flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                    <div>
                      <p className="font-medium text-white">{meta.label}</p>
                      {meta.hint && <p className="mt-0.5 text-sm text-slate-400">{meta.hint}</p>}
                      <p className={`mt-1 text-xs font-semibold ${on ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {on ? 'Activée' : 'Désactivée'}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      onClick={() => onChange(f.key, !on)}
                      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${on ? 'bg-cyan-500' : 'bg-slate-700'}`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${on ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                );
              }
              return (
                <Input
                  key={f.key}
                  label={meta.label}
                  type={f.secret ? 'password' : 'text'}
                  value={values[f.key] ?? ''}
                  onChange={(e) => onChange(f.key, e.target.value)}
                  placeholder={
                    f.secret
                      ? f.configured
                        ? `${f.preview} — laisser vide pour conserver`
                        : 'Non configurée'
                      : meta.hint || ''
                  }
                />
              );
            })}
          </div>
        </div>
      ))}

      {/* Barre d'enregistrement finale */}
      <div className="flex items-center gap-4">
        <Button onClick={() => save()} loading={saving} variant="primary" className="shadow-lg shadow-cyan-500/20">
          <Save className="h-4 w-4" /> Enregistrer les paramètres
        </Button>
      </div>

      <div className="card flex items-start gap-3 p-5 border border-slate-800 bg-slate-900/50">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
        <p className="text-sm text-slate-400">
          Les clés secrètes sont chiffrées au repos (AES-256-GCM). Dès que vous enregistrez une nouvelle clé ou un nouveau modèle, les changements prennent effet immédiatement pour tous les utilisateurs du site sans interruption ni redémarrage.
        </p>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }) {
  return (
    <div className="card flex items-center gap-4 p-5 border border-slate-800 bg-slate-900/60">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-slate-950 font-bold shadow-md shadow-cyan-500/20">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-lg font-bold capitalize text-white">{value || '—'}</p>
      </div>
    </div>
  );
}
