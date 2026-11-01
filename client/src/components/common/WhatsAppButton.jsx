import { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { paymentApi } from '../../services/endpoints.js';

export default function WhatsAppButton() {
  const [whatsappUrl, setWhatsappUrl] = useState('https://wa.me/22900000000');
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    paymentApi.getConfig()
      .then((res) => {
        if (res.data?.data?.whatsappUrl) {
          setWhatsappUrl(res.data.data.whatsappUrl);
        }
      })
      .catch(() => {});
  }, []);

  if (!whatsappUrl) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
      {/* Tooltip bubble */}
      <div
        className={`hidden sm:flex items-center gap-2 rounded-xl bg-slate-900/90 text-white px-3.5 py-2 text-xs font-semibold shadow-xl border border-slate-700/80 backdrop-blur-md transition-all duration-300 pointer-events-none ${
          isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
        }`}
      >
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>Support WhatsApp Direct</span>
      </div>

      {/* Floating Action Button */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label="Contacter le support WhatsApp"
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-105 active:scale-95 transition-all duration-300"
      >
        {/* Glow pulse ring */}
        <span className="absolute -inset-1 rounded-full bg-[#25D366] opacity-30 group-hover:opacity-60 animate-ping"></span>

        {/* WhatsApp Icon */}
        <MessageCircle className="h-7 w-7 relative z-10 transition group-hover:scale-110" />

        {/* Online Status Dot */}
        <span className="absolute top-1 right-1 h-3.5 w-3.5 rounded-full bg-white flex items-center justify-center">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
        </span>
      </a>
    </div>
  );
}
