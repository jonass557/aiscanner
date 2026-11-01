import { Link } from 'react-router-dom';
import { ScanLine, ShieldAlert } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.jsx';

export default function PublicFooter() {
  const { lang } = useLanguage();
  const isEn = lang === 'en';

  return (
    <footer className="border-t border-slate-900 bg-slate-950 text-slate-400">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-5">
        <div className="md:col-span-2">
          <Link to="/" className="flex items-center gap-2 font-bold text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-slate-950 shadow-md shadow-cyan-500/20 font-black">
              <ScanLine className="h-5 w-5" />
            </span>
            <span className="text-lg">AI Chart Scanner</span>
          </Link>
          <p className="mt-4 max-w-xs text-xs text-slate-400 leading-relaxed">
            {isEn
              ? 'Institutional AI trading ecosystem for independent traders and prop firms. Real-time Smart Money Concepts analysis, autonomous robots, and multi-timeframe precision.'
              : 'Écosystème d’intelligence artificielle institutionnelle pour traders indépendants et prop firms. Analyses SMC en direct, robots autonomes et confluences multi-timeframes.'}
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400 font-mono">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Système Opérationnel 100% · v4.5 Pro
          </div>
        </div>

        <div>
          <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-white">
            {isEn ? 'Platform' : 'Plateforme'}
          </h4>
          <ul className="space-y-2.5 text-xs">
            <li>
              <Link to="/tools" className="hover:text-cyan-300 transition">
                {isEn ? 'All 11 AI Tools' : 'Tous les 11 Outils IA'}
              </Link>
            </li>
            <li>
              <a href="#pricing" className="hover:text-cyan-300 transition">
                {isEn ? 'Subscriptions' : 'Plans & Abonnements'}
              </a>
            </li>
            <li>
              <a href="#how" className="hover:text-cyan-300 transition">
                {isEn ? 'How It Works' : 'Comment ça Marche'}
              </a>
            </li>
            <li>
              <a href="#faq" className="hover:text-cyan-300 transition">
                {isEn ? 'FAQ' : 'Questions Fréquentes'}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-white">
            {isEn ? 'Markets' : 'Marchés'}
          </h4>
          <ul className="space-y-2.5 text-xs text-slate-400">
            <li>Forex Majors & Crosses</li>
            <li>Or (XAU/USD) & Métaux</li>
            <li>Indices Boursiers (US30, NAS100)</li>
            <li>Crypto-monnaies (BTC, ETH)</li>
            <li>Indices Synthétiques Deriv (Vol 75)</li>
          </ul>
        </div>

        <div>
          <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-white">
            {isEn ? 'Legal & Risk' : 'Légal & Risque'}
          </h4>
          <ul className="space-y-2.5 text-xs">
            <li>
              <span className="text-slate-400">Paiement Sécurisé iKeePay</span>
            </li>
            <li>
              <span className="text-slate-400">Confidentialité SSL</span>
            </li>
            <li>
              <span className="text-slate-400">Zéro Engagement</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-900 bg-slate-950/80 px-6 py-6 text-center text-xs text-slate-500">
        <p className="max-w-4xl mx-auto flex items-center justify-center gap-1.5 text-[11px] leading-relaxed">
          <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
          <span>
            {isEn
              ? 'Trading forex, CFDs, cryptocurrencies, and synthetic indices involves significant financial risk. AI Chart Scanner provides educational and probabilistic analysis tools. Past performance does not guarantee future results.'
              : 'Le trading sur le Forex, CFD, cryptomonnaies et indices synthétiques comporte un niveau de risque élevé. AI Chart Scanner est un outil d’aide à la décision algorithmique et ne constitue pas un conseil financier.'}
          </span>
        </p>
        <p className="mt-3 font-mono text-[11px]">
          © {new Date().getFullYear()} AI Chart Scanner Technologies. Tous droits réservés.
        </p>
      </div>
    </footer>
  );
}
