import { Link } from 'react-router-dom';
import { ScanLine, Twitter, Github, Linkedin } from 'lucide-react';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'How it works', href: '#how' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'Contact', href: '#' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '#' },
      { label: 'Terms', href: '#' },
      { label: 'Disclaimer', href: '#' },
    ],
  },
];

/** Landing-page footer with brand, link columns, and social icons. */
export default function PublicFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-5">
        <div className="md:col-span-2">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-accent-600 text-white">
              <ScanLine className="h-5 w-5" />
            </span>
            <span className="text-lg">AI Chart Scanner</span>
          </Link>
          <p className="mt-4 max-w-xs text-sm text-gray-500">
            Institutional-grade AI analysis of your trading charts. Upload, scan, and trade with confidence.
          </p>
          <div className="mt-5 flex gap-3">
            {[Twitter, Github, Linkedin].map((Icon, i) => (
              <a key={i} href="#" className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-brand-500 hover:text-brand-600 dark:border-gray-700">
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h4 className="mb-4 text-sm font-semibold">{col.title}</h4>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="text-sm text-gray-500 transition hover:text-brand-600">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-200 py-6 dark:border-gray-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-xs text-gray-500 sm:flex-row">
          <p>© {new Date().getFullYear()} AI Chart Scanner. All rights reserved.</p>
          <p>Not financial advice. Trade responsibly.</p>
        </div>
      </div>
    </footer>
  );
}
