import { useEffect, useState } from 'react';
import { Users, ScanLine, DollarSign, CheckCircle2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import Spinner from '../../components/ui/Spinner.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { adminApi } from '../../services/endpoints.js';
import { formatNumber, formatDate } from '../../utils/format.js';

/** Admin dashboard: global KPIs, plan distribution, recent signups. */
export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.stats().then(({ data }) => setStats(data.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Loading admin stats…" />;

  const kpis = [
    { label: 'Total users', value: formatNumber(stats.users.total), icon: Users, tone: 'purple' },
    { label: 'Verified users', value: formatNumber(stats.users.verified), icon: CheckCircle2, tone: 'green' },
    { label: 'Total scans', value: formatNumber(stats.scans.total), icon: ScanLine, tone: 'blue' },
    { label: 'Est. MRR', value: `$${formatNumber(stats.revenue.estimatedMonthly)}`, icon: DollarSign, tone: 'yellow' },
  ];

  const planData = Object.entries(stats.users.byPlan || {}).map(([name, count]) => ({ name, count }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Overview</h1>
        <p className="mt-1 text-sm text-gray-500">
          {formatNumber(stats.scans.today)} scans today · {formatNumber(stats.scans.thisMonth)} this month.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{k.label}</span>
              <Badge tone={k.tone}><k.icon className="h-3.5 w-3.5" /></Badge>
            </div>
            <p className="mt-2 text-3xl font-bold">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h3 className="font-semibold">Users by plan</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={planData}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', background: '#1f2937', color: '#fff' }} />
                <Bar dataKey="count" fill="#6366f1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-semibold">Recent signups</h3>
          <div className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
            {stats.recentUsers.map((u) => (
              <div key={u._id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-bold text-white">
                    {(u.firstName?.[0] || u.email[0]).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{u.firstName ? `${u.firstName} ${u.lastName || ''}` : u.email}</p>
                    <p className="text-xs text-gray-500">{formatDate(u.createdAt)}</p>
                  </div>
                </div>
                <Badge tone="purple">{u.subscription?.plan}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Vision-model quality (Engine 5 — continuous improvement). */}
      {Array.isArray(stats.quality) && stats.quality.length > 0 && (
        <div className="card p-6">
          <h3 className="font-semibold">Vision model quality</h3>
          <p className="mt-1 text-sm text-gray-500">
            User 👍/👎 feedback and average confidence per provider — a base for A/B comparison.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase text-gray-400 dark:border-gray-800">
                  <th className="py-2 pr-4">Provider</th>
                  <th className="py-2 pr-4">Engine</th>
                  <th className="py-2 pr-4 text-right">Scans</th>
                  <th className="py-2 pr-4 text-right">👍</th>
                  <th className="py-2 pr-4 text-right">👎</th>
                  <th className="py-2 pr-4 text-right">Satisfaction</th>
                  <th className="py-2 text-right">Avg conf.</th>
                </tr>
              </thead>
              <tbody>
                {stats.quality.map((q, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50">
                    <td className="py-2 pr-4 font-medium capitalize">{(q.provider || '—').replace('-vision', '')}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-gray-500">{q.engineVersion || '—'}</td>
                    <td className="py-2 pr-4 text-right">{formatNumber(q.total)}</td>
                    <td className="py-2 pr-4 text-right text-green-600">{q.up}</td>
                    <td className="py-2 pr-4 text-right text-red-500">{q.down}</td>
                    <td className="py-2 pr-4 text-right">
                      {q.satisfaction == null ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <Badge tone={q.satisfaction >= 60 ? 'green' : q.satisfaction >= 40 ? 'yellow' : 'red'}>
                          {q.satisfaction}%
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 text-right">{q.avgConfidence != null ? `${q.avgConfidence}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
