import { Link } from 'react-router-dom';
import { ScanLine, ArrowLeft } from 'lucide-react';

/**
 * Split-screen shell for all auth pages: a branded gradient panel on the left
 * and the form on the right (form-only on mobile).
 */
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-cyan-950 via-slate-900 to-indigo-950 lg:block border-r border-slate-800">
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Link to="/" className="flex items-center gap-2 font-bold group">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/40">
              <ScanLine className="h-5 w-5" />
            </span>
            <span className="text-lg">AI Chart Scanner</span>
          </Link>
          <div>
            <h2 className="text-3xl font-extrabold leading-tight text-white">
              L'analyse technique de pointe au service de vos performances.
            </h2>
            <p className="mt-4 max-w-md text-slate-300">
              Chargez vos graphiques et obtenez instantanément une analyse Smart Money Concepts (SMC), un plan de trade complet et l'appui d'un assistant vocal intelligent.
            </p>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Trading à haute probabilité de succès.</span>
            <Link to="/" className="inline-flex items-center gap-1.5 text-cyan-400 hover:underline">
              <ArrowLeft className="h-3.5 w-3.5" /> Visiter la page d'accueil
            </Link>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          {/* Top navigation link back to landing page */}
          <div className="mb-6 flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-500/40 hover:bg-slate-800 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-cyan-400" /> Retour à l'accueil
            </Link>
          </div>

          <Link to="/" className="mb-8 flex items-center gap-2 font-bold lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/40">
              <ScanLine className="h-5 w-5" />
            </span>
            <span className="text-lg">AI Chart Scanner</span>
          </Link>

          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-slate-400">{subtitle}</p>}

          <div className="mt-8">{children}</div>

          {footer && <div className="mt-6 text-center text-sm text-slate-400">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
