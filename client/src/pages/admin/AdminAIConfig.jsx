import { useEffect, useState } from 'react';
import { Cpu, CheckCircle2, XCircle, Info } from 'lucide-react';
import Badge from '../../components/ui/Badge.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { adminApi } from '../../services/endpoints.js';

/**
 * Read-only view of the active AI provider configuration. Keys are masked by
 * the backend. The provider is selected via the AI_PROVIDER env var; this
 * surface makes the abstraction layer's state visible to admins.
 */
export default function AdminAIConfig() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.aiConfig().then(({ data }) => setConfig(data.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Loading AI config…" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Configuration</h1>
        <p className="mt-1 text-sm text-gray-500">Vision-model providers behind the analysis abstraction layer.</p>
      </div>

      <div className="card flex items-center gap-4 p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white">
          <Cpu className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-gray-500">Active provider</p>
          <p className="text-xl font-bold capitalize">{config.activeProvider}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(config.providers).map(([name, p]) => (
          <div key={name} className={`card p-5 ${name === config.activeProvider ? 'ring-2 ring-brand-500' : ''}`}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold capitalize">{name}</h3>
              {p.configured ? (
                <Badge tone="green"><CheckCircle2 className="h-3.5 w-3.5" /> Configured</Badge>
              ) : (
                <Badge tone="gray"><XCircle className="h-3.5 w-3.5" /> No key</Badge>
              )}
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Model</dt>
                <dd className="font-mono text-xs">{p.model}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">API key</dt>
                <dd className="font-mono text-xs">{p.keyPreview || '—'}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <div className="card flex items-start gap-3 p-5">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Providers are swappable without code changes: set <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-800">AI_PROVIDER</code> and the
          corresponding API key in the server environment. When no key is configured, the platform falls back
          to a deterministic mock analyst so the full flow keeps working in development.
        </p>
      </div>
    </div>
  );
}
