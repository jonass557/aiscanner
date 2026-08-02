import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Moon, Sun, Bell, Shield, Palette, TrendingUp, Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext.jsx';
import { userApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';
import Button from '../../components/ui/Button.jsx';

const LEVELS = [
  { value: 'beginner', label: 'Débutant' },
  { value: 'intermediate', label: 'Intermédiaire' },
  { value: 'expert', label: 'Expert' },
];

const STRATEGIES = [
  { value: 'smc', label: 'Smart Money Concepts (SMC)' },
  { value: 'ict', label: 'ICT' },
  { value: 'price-action', label: 'Price Action' },
  { value: 'custom', label: 'Ma propre stratégie' },
];

const MARKET_OPTIONS = [
  { value: 'forex', label: 'Forex' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'indices', label: 'Indices' },
  { value: 'commodities', label: 'Commodities' },
  { value: 'synthetic', label: 'Deriv Synthétiques' },
];

const TIMEFRAME_OPTIONS = ['M5', 'M15', 'M30', 'H1', 'H4', 'D1'];

/** User preferences: theme, notifications, and trading preferences (persisted). */
export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const [notifs, setNotifs] = useState(() => ({
    emailAlerts: localStorage.getItem('acs_notif_email') === 'true',
    scanComplete: localStorage.getItem('acs_notif_scan') !== 'false',
  }));

  const [prefs, setPrefs] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    userApi
      .getPreferences()
      .then(({ data }) => setPrefs(data.data.preferences))
      .catch(() => setPrefs({}));
  }, []);

  const toggleNotif = (key, storageKey) => {
    setNotifs((n) => {
      const next = { ...n, [key]: !n[key] };
      localStorage.setItem(storageKey, String(next[key]));
      return next;
    });
  };

  const setPref = (key, value) => setPrefs((p) => ({ ...p, [key]: value }));

  const toggleInArray = (key, value) =>
    setPref(
      key,
      prefs?.[key]?.includes(value)
        ? prefs[key].filter((v) => v !== value)
        : [...(prefs?.[key] || []), value]
    );

  const savePrefs = async () => {
    setSaving(true);
    try {
      await userApi.updatePreferences(prefs);
      toast.success('Préférences trading enregistrées.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const Row = ({ icon: Icon, title, desc, children }) => (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-gray-500">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );

  const Toggle = ({ on, onClick }) => (
    <button
      onClick={onClick}
      className={`relative h-6 w-11 rounded-full transition ${on ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-700'}`}
      role="switch"
      aria-checked={on}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );

  const selectCls =
    'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800';
  const labelCls = 'mb-1 block text-xs font-medium text-gray-500';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Customize your experience.</p>
      </div>

      <div className="card p-6">
        <h3 className="mb-2 flex items-center gap-2 font-semibold">
          <Palette className="h-4 w-4" /> Appearance
        </h3>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          <Row icon={theme === 'dark' ? Moon : Sun} title="Theme" desc="Switch between light and dark mode">
            <Toggle on={theme === 'dark'} onClick={toggleTheme} />
          </Row>
        </div>
      </div>

      {/* Trading preferences — drives the AI Trading Assistant */}
      <div className="card p-6">
        <h3 className="mb-2 flex items-center gap-2 font-semibold">
          <TrendingUp className="h-4 w-4" /> Préférences de trading
        </h3>
        <p className="text-xs text-gray-500">
          Utilisées par l'AI Trading Assistant pour adapter toutes vos analyses à votre profil.
        </p>

        {!prefs ? (
          <p className="py-6 text-center text-sm text-gray-500">Chargement…</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Niveau</label>
              <select className={selectCls} value={prefs.level || 'intermediate'} onChange={(e) => setPref('level', e.target.value)}>
                {LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Stratégie favorite</label>
              <select className={selectCls} value={prefs.favoriteStrategy || 'smc'} onChange={(e) => setPref('favoriteStrategy', e.target.value)}>
                {STRATEGIES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            {prefs.favoriteStrategy === 'custom' && (
              <div className="sm:col-span-2">
                <label className={labelCls}>Ma stratégie personnelle (texte libre)</label>
                <textarea
                  className="min-h-[100px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
                  placeholder="Ex : j'entre sur le retest d'un order block en H4 avec confluence FVG, je ne trade jamais contre la tendance D1, SL derrière la structure…"
                  value={prefs.customStrategy || ''}
                  onChange={(e) => setPref('customStrategy', e.target.value)}
                />
              </div>
            )}
            <div>
              <label className={labelCls}>Risque par trade (%)</label>
              <input
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                className={selectCls}
                value={prefs.riskPercent ?? 1}
                onChange={(e) => setPref('riskPercent', Number(e.target.value))}
              />
            </div>
            <div>
              <label className={labelCls}>Ratio risque/rendement minimum</label>
              <input
                type="number"
                min="0.5"
                max="20"
                step="0.5"
                className={selectCls}
                value={prefs.minRiskReward ?? 2}
                onChange={(e) => setPref('minRiskReward', Number(e.target.value))}
              />
              <p className="mt-1 text-[11px] text-gray-400">Ex : 3 → exiger au moins 1:3.</p>
            </div>
            <div>
              <label className={labelCls}>Langue de réponse</label>
              <select className={selectCls} value={prefs.language || 'fr'} onChange={(e) => setPref('language', e.target.value)}>
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Marchés favoris</label>
              <div className="flex flex-wrap gap-1.5">
                {MARKET_OPTIONS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => toggleInArray('favoriteMarkets', m.value)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      prefs.favoriteMarkets?.includes(m.value)
                        ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300'
                        : 'border-gray-200 text-gray-500 hover:border-brand-300 dark:border-gray-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Timeframes préférés</label>
              <div className="flex flex-wrap gap-1.5">
                {TIMEFRAME_OPTIONS.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => toggleInArray('favoriteTimeframes', tf)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      prefs.favoriteTimeframes?.includes(tf)
                        ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300'
                        : 'border-gray-200 text-gray-500 hover:border-brand-300 dark:border-gray-700'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-end sm:col-span-2">
              <Button onClick={savePrefs} loading={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer les préférences'}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="card p-6">
        <h3 className="mb-2 flex items-center gap-2 font-semibold">
          <Bell className="h-4 w-4" /> Notifications
        </h3>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          <Row icon={Bell} title="Scan complete" desc="Notify me when an analysis finishes">
            <Toggle on={notifs.scanComplete} onClick={() => toggleNotif('scanComplete', 'acs_notif_scan')} />
          </Row>
          <Row icon={Bell} title="Email alerts" desc="Receive product and trade-signal emails">
            <Toggle on={notifs.emailAlerts} onClick={() => toggleNotif('emailAlerts', 'acs_notif_email')} />
          </Row>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="mb-2 flex items-center gap-2 font-semibold">
          <Shield className="h-4 w-4" /> Privacy
        </h3>
        <p className="text-sm text-gray-500">
          Your charts and analyses are private to your account. You can delete any analysis from the History
          page at any time.
        </p>
      </div>
    </div>
  );
}
