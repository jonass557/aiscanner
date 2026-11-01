import { useEffect, useState } from 'react';
import {
  BarChart3,
  Users,
  Eye,
  Smartphone,
  Monitor,
  Tablet,
  TrendingUp,
  RefreshCw,
  Compass,
  FileText,
  Activity,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import Spinner from '../../components/ui/Spinner.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import { analyticsApi } from '../../services/endpoints.js';
import { formatNumber } from '../../utils/format.js';

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const res = await analyticsApi.adminAnalytics();
      setData(res.data.data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner label="Chargement des statistiques d'audience..." />
      </div>
    );
  }

  const summary = data?.summary || { totalViews: 0, todayViews: 0, uniqueVisitorsToday: 0 };
  const topFeatures = data?.topFeatures || [];
  const topPages = data?.topPages || [];
  const devices = data?.devices || [];
  const timeline = data?.timeline || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Analytics & Fréquentation de la Plateforme
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mesure en temps réel des fonctionnalités les plus utilisées et des pages les plus consultées.
              </p>
            </div>
          </div>
        </div>

        <Button
          variant="secondary"
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 self-start text-xs sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Actualisation...' : 'Actualiser'}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Visites Cumulées</span>
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-500">
              <Eye className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">
            {formatNumber(summary.totalViews)}
          </p>
          <p className="mt-1 text-xs text-slate-400">Pages vues enregistrées sur la plateforme</p>
        </div>

        <div className="card p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Visites Aujourd'hui</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-black text-emerald-500">
            {formatNumber(summary.todayViews)}
          </p>
          <p className="mt-1 text-xs text-slate-400">Interactions & consultations depuis minuit</p>
        </div>

        <div className="card p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Utilisateurs Uniques (Aujourd'hui)</span>
            <div className="rounded-lg bg-purple-500/10 p-2 text-purple-500">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-black text-purple-500">
            {formatNumber(summary.uniqueVisitorsToday)}
          </p>
          <p className="mt-1 text-xs text-slate-400">Traders distincts actifs aujourd'hui</p>
        </div>
      </div>

      {/* Main Grid: Top Features & Top Pages */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Features */}
        <div className="card p-6 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-brand-500" />
              <h2 className="font-bold text-slate-900 dark:text-white text-sm">
                Fonctionnalités les Plus Visité(e)s
              </h2>
            </div>
            <Badge tone="purple">Top 10</Badge>
          </div>

          <div className="mt-4 space-y-3">
            {topFeatures.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-400">Aucune donnée pour le moment.</p>
            ) : (
              topFeatures.map((feat, idx) => (
                <div key={feat.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500">
                        {idx + 1}
                      </span>
                      {feat.name}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {formatNumber(feat.count)} vues ({feat.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-cyan-400 transition-all duration-500"
                      style={{ width: `${Math.max(5, Math.min(100, feat.percentage))}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Pages */}
        <div className="card p-6 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-500" />
              <h2 className="font-bold text-slate-900 dark:text-white text-sm">
                Pages les Plus Consultées (URLs)
              </h2>
            </div>
            <Badge tone="green">Trafic direct</Badge>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left uppercase text-slate-400 text-[10px]">
                  <th className="py-2 pr-3">Chemin URL</th>
                  <th className="py-2 pr-3">Section / Module</th>
                  <th className="py-2 text-right">Consultations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                {topPages.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400 font-sans">
                      Aucune page enregistrée.
                    </td>
                  </tr>
                ) : (
                  topPages.map((page) => (
                    <tr key={page.path} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 pr-3 font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                        {page.path}
                      </td>
                      <td className="py-2.5 pr-3 font-sans text-slate-500">
                        {page.feature}
                      </td>
                      <td className="py-2.5 text-right font-sans font-bold text-brand-500">
                        {formatNumber(page.count)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Traffic Trend Chart & Device Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Timeline Chart */}
        <div className="card p-6 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-500" />
              <h2 className="font-bold text-slate-900 dark:text-white text-sm">
                Évolution des Visites (14 Derniers Jours)
              </h2>
            </div>
            <span className="text-[11px] text-slate-400">Pages vues & Visiteurs uniques</span>
          </div>

          <div className="h-64">
            {timeline.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                Données d'activité en cours de collecte...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline}>
                  <defs>
                    <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 10,
                      border: 'none',
                      background: '#0f172a',
                      color: '#fff',
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="views"
                    name="Pages vues"
                    stroke="#06b6d4"
                    fillOpacity={1}
                    fill="url(#viewsGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Device Breakdown */}
        <div className="card p-6 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Compass className="h-4 w-4 text-amber-500" />
            <h2 className="font-bold text-slate-900 dark:text-white text-sm">
              Répartition par Appareil
            </h2>
          </div>

          <div className="space-y-4">
            {devices.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-400">Aucune donnée d'appareil.</p>
            ) : (
              devices.map((dev) => {
                const Icon = dev.type === 'mobile' ? Smartphone : dev.type === 'tablet' ? Tablet : Monitor;
                const label = dev.type === 'mobile' ? 'Smartphones (Mobile)' : dev.type === 'tablet' ? 'Tablettes' : 'Ordinateurs (Desktop)';
                return (
                  <div key={dev.type} className="rounded-xl border border-slate-100 dark:border-slate-800/80 p-3 bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                        <Icon className="h-4 w-4 text-brand-500" />
                        <span>{label}</span>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white">{dev.percentage}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${dev.percentage}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">{formatNumber(dev.count)} sessions</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
