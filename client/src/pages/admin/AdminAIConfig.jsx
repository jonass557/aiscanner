import { useEffect, useState } from 'react';
import { Cpu, CheckCircle2, XCircle, Info, Save, PlugZap, Eye } from 'lucide-react';
import Badge from '../../components/ui/Badge.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import { adminApi } from '../../services/endpoints.js';

/**
 * Editable AI / Vision / Payments configuration.
 *
 * The backend exposes a whitelist of settings grouped by category. Secrets are
 * never sent to the client in clear — only a "configured" flag and a masked
 * preview — so their inputs start blank and are only submitted when the admin
 * types a new value (blank = leave unchanged). Non-secret values (models,
 * active provider, base URLs) are editable directly.
 */

// Human-friendly labels + input hints per setting key.
const FIELD_META = {
  'ai.provider': { label: 'Active reasoning provider', hint: 'openai | claude | gemini | nvidia' },
  'vision.provider': { label: 'Active vision provider', hint: 'openai | claude | gemini | nvidia | mock' },
  'ai.openai.apiKey': { label: 'OpenAI API key', secret: true },
  'ai.openai.model': { label: 'OpenAI model', hint: 'gpt-4o' },
  'ai.claude.apiKey': { label: 'Anthropic API key', secret: true },
  'ai.claude.model': { label: 'Claude model', hint: 'claude-3-opus-20240229' },
  'ai.gemini.apiKey': { label: 'Gemini API key', secret: true },
  'ai.gemini.model': { label: 'Gemini model', hint: 'gemini-1.5-pro' },
  'ai.nvidia.apiKey': { label: 'NVIDIA API key', secret: true },
  'ai.nvidia.model': { label: 'NVIDIA model', hint: 'meta/llama-3.2-90b-vision-instruct' },
  'ai.nvidia.baseUrl': { label: 'NVIDIA base URL', hint: 'https://integrate.api.nvidia.com/v1' },
  'payments.provider': { label: 'Active payment provider', hint: 'sebpay | demo' },
  'payments.sebpay.publicKey': { label: 'SebPay public key', secret: true },
  'payments.sebpay.secretKey': { label: 'SebPay secret key', secret: true },
  'payments.sebpay.baseUrl': { label: 'SebPay base URL', hint: 'https://new.sebpay.bj/api' },
  'payments.sebpay.callbackUrl': { label: 'SebPay callback URL' },
};

const CATEGORY_TITLES = {
  ai: 'AI Providers (OpenAI · Claude · Gemini · NVIDIA)',
  vision: 'Computer Vision Engine',
  payments: 'Payments (SebPay)',
};

const TESTABLE = ['openai', 'claude', 'gemini', 'nvidia'];

export default function AdminAIConfig() {
  const [aiConfig, setAiConfig] = useState(null);
  const [groups, setGroups] = useState({});
  const [values, setValues] = useState({}); // key -> current input value
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(null); // { tone, text }
  const [tests, setTests] = useState({}); // provider -> { loading, ok, message }

  const load = async () => {
    const [{ data: cfg }, { data: st }] = await Promise.all([adminApi.aiConfig(), adminApi.settings()]);
    setAiConfig(cfg.data);
    const grouped = st.data.settings;
    setGroups(grouped);
    // Seed input values: non-secrets with their value, secrets blank.
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

  const save = async () => {
    setSaving(true);
    setFlash(null);
    // Only submit fields that carry a value: for secrets a blank means
    // "unchanged"; for non-secrets we send the (possibly edited) value.
    const payload = [];
    Object.values(groups).flat().forEach((f) => {
      const val = values[f.key];
      if (f.secret) {
        if (val && val.trim()) payload.push({ key: f.key, value: val.trim() });
      } else {
        payload.push({ key: f.key, value: val ?? '' });
      }
    });
    try {
      await adminApi.updateSettings(payload);
      setFlash({ tone: 'green', text: 'Settings saved.' });
      await load();
    } catch (err) {
      setFlash({ tone: 'red', text: err.response?.data?.message || 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  const runTest = async (provider) => {
    setTests((t) => ({ ...t, [provider]: { loading: true } }));
    try {
      const { data } = await adminApi.testProvider(provider);
      setTests((t) => ({ ...t, [provider]: { loading: false, ...data.data } }));
    } catch (err) {
      setTests((t) => ({
        ...t,
        [provider]: { loading: false, ok: false, message: err.response?.data?.message || 'Test failed.' },
      }));
    }
  };

  if (loading) return <Spinner label="Loading AI config…" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI &amp; Provider Configuration</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage API keys and active providers at runtime. Changes apply immediately — no redeploy.
        </p>
      </div>

      {/* Active-provider summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard icon={Cpu} label="Reasoning provider" value={aiConfig.activeProvider} />
        <SummaryCard icon={Eye} label="Vision provider" value={aiConfig.activeVisionProvider} />
        <SummaryCard icon={PlugZap} label="Payments" value={aiConfig.activePaymentProvider} />
      </div>

      {/* Provider status + connection test */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Object.entries(aiConfig.providers).map(([name, p]) => {
          const test = tests[name];
          return (
            <div key={name} className="card p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold capitalize">{name}</h3>
                {p.configured ? (
                  <Badge tone="green"><CheckCircle2 className="h-3.5 w-3.5" /> Configured</Badge>
                ) : (
                  <Badge tone="gray"><XCircle className="h-3.5 w-3.5" /> No key</Badge>
                )}
              </div>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Model</dt>
                  <dd className="truncate font-mono text-xs">{p.model || '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Key</dt>
                  <dd className="font-mono text-xs">{p.keyPreview || '—'}</dd>
                </div>
              </dl>
              {TESTABLE.includes(name) && (
                <div className="mt-3">
                  <Button variant="secondary" className="w-full text-xs" loading={test?.loading} onClick={() => runTest(name)}>
                    <PlugZap className="h-3.5 w-3.5" /> Test connection
                  </Button>
                  {test && !test.loading && (
                    <p className={`mt-2 text-xs ${test.ok ? 'text-green-600' : 'text-red-500'}`}>{test.message}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Editable settings, grouped by category */}
      {Object.entries(groups).map(([category, fields]) => (
        <div key={category} className="card p-6">
          <h2 className="mb-4 text-lg font-semibold">{CATEGORY_TITLES[category] || category}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {fields.map((f) => {
              const meta = FIELD_META[f.key] || { label: f.key };
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
                        ? `${f.preview} — leave blank to keep`
                        : 'Not set'
                      : meta.hint || ''
                  }
                />
              );
            })}
          </div>
        </div>
      ))}

      {/* Save bar */}
      <div className="flex items-center gap-4">
        <Button onClick={save} loading={saving}>
          <Save className="h-4 w-4" /> Save changes
        </Button>
        {flash && <span className={`text-sm ${flash.tone === 'green' ? 'text-green-600' : 'text-red-500'}`}>{flash.text}</span>}
      </div>

      <div className="card flex items-start gap-3 p-5">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Secrets are encrypted at rest (AES-256-GCM) and never shown in full. Leaving a secret field blank keeps the
          existing key. Database values override environment variables; when a key is missing everywhere, the platform
          falls back to a deterministic mock so the full flow keeps working.
        </p>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-lg font-bold capitalize">{value || '—'}</p>
      </div>
    </div>
  );
}
