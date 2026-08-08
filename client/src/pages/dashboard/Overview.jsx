import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ScanLine, TrendingUp, Target, Gauge, ArrowRight, Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import Spinner from '../../components/ui/Spinner.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { analysisApi } from '../../services/endpoints.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { decisionMeta, formatDate, marketLabel } from '../../utils/format.js';

const DECISION_COLORS = { BUY: '#22c55e', SELL: '#ef4444', WAIT: '#f59e0b', NO_TRADE: '#9ca3af' };

/** Dashboard overview: KPI cards, 7-day activity chart, decision split, recent. */
export default function Overview() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analysisApi
      .stats()
      .then(({ data }) => setStats(data.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Loading your dashboard…" />;

  const sub = stats?.subscription || {};
  const remaining = sub.scansPerMonth === -1 ? '∞' : Math.max(0, sub.scansPerMonth - sub.scansUsed);

  const kpis = [
    { label: 'Total scans', value: stats?.total ?? 0, icon: ScanLine, tone: 'purple' },
    { label: 'Avg. confidence', value: `${stats?.avgConfidence ?? 0}%`, icon: Gauge, tone: 'blue' },
    { label: 'Buy signals', value: stats?.byDecision?.BUY ?? 0, icon: TrendingUp, tone: 'green' },
    { label: 'Scans left', value: remaining, icon: Target, tone: 'yellow' },
  ];

  // Build a 7-day series with zero-fill.
  const dailyMap = Object.fromEntries((stats?.dailyScans || []).map((d) => [d._id, d.count]));
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return { date: d.toLocaleDateString('en-US', { weekday: 'short' }), scans: dailyMap[key] || 0 };
  });

  const decisionData = Object.entries(stats?.byDecision || {}).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back{user?.firstName ? `, ${user.firstName}` : ''} 👋
          </h1>
          <p className="mt-1 text-sm text-gray-500">Here&apos;s your trading analysis overview.</p>
        </div>
        <Link to="/dashboard/scanner" className="btn-primary">
          <ScanLine className="h-4 w-4" /> New scan
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{k.label}</span>
              <Badge tone={k.tone}>
                <k.icon className="h-3.5 w-3.5" />
              </Badge>
            </div>
            <p className="mt-2 text-3xl font-bold">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Activity chart */}
        <div className="card p-6 lg:col-span-2">
          <h3 className="font-semibold">Activity (last 7 days)</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={days}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', background: '#1f2937', color: '#fff' }} />
                <Area type="monotone" dataKey="scans" stroke="#6366f1" strokeWidth={2} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Decision split */}
        <div className="card p-6">
          <h3 className="font-semibold">Decision split</h3>
          {decisionData.length ? (
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={decisionData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {decisionData.map((d) => (
                      <Cell key={d.name} fill={DECISION_COLORS[d.name] || '#9ca3af'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', background: '#1f2937', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-6 text-sm text-gray-500">No scans yet — run your first analysis!</p>
          )}
        </div>
      </div>

      {/* Recent analyses */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Recent analyses</h3>
          <Link to="/dashboard/history" className="flex items-center gap-1 text-sm text-brand-600 hover:underline">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {stats?.recent?.length ? (
          <div className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
            {stats.recent.map((a) => {
              const meta = decisionMeta(a.decision);
              return (
                <Link
                  key={a._id}
                  to={`/dashboard/history/${a._id}`}
                  className="flex items-center justify-between py-3 transition hover:opacity-80"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-2.5 w-2.5 rounded-full ${meta.bg}`} />
                    <div>
                      <p className="text-sm font-medium">{a.symbol} · {a.timeframe}</p>
                      <p className="text-xs text-gray-500">{marketLabel(a.market)} · {formatDate(a.createdAt)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <p className="mt-1 text-xs text-gray-500">{a.confidenceScore}%</p>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center py-8 text-center">
            <Sparkles className="h-10 w-10 text-brand-400" />
            <p className="mt-3 text-sm text-gray-500">No analyses yet. Your scans will appear here.</p>
            <Link to="/dashboard/scanner" className="btn-primary mt-4">Run first scan</Link>
          </div>
        )}
      </div>
    </div>
  );
}
