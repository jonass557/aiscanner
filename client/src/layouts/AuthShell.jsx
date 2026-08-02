import { Link } from 'react-router-dom';
import { ScanLine } from 'lucide-react';

/**
 * Split-screen shell for all auth pages: a branded gradient panel on the left
 * and the form on the right (form-only on mobile).
 */
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-brand-600 via-accent-600 to-brand-800 lg:block">
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
              <ScanLine className="h-5 w-5" />
            </span>
            <span className="text-lg">AI Chart Scanner</span>
          </Link>
          <div>
            <h2 className="text-3xl font-bold leading-tight">
              Institutional-grade chart analysis, one click away.
            </h2>
            <p className="mt-4 max-w-md text-white/80">
              Upload any chart and get a complete Smart Money Concepts breakdown, a clear decision, and a
              full trade plan in seconds.
            </p>
          </div>
          <p className="text-sm text-white/60">Not financial advice. Trade responsibly.</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-2 font-bold lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-accent-600 text-white">
              <ScanLine className="h-5 w-5" />
            </span>
            <span className="text-lg">AI Chart Scanner</span>
          </Link>

          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-gray-500">{subtitle}</p>}

          <div className="mt-8">{children}</div>

          {footer && <div className="mt-6 text-center text-sm text-gray-500">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
