import { useLocation, useNavigate } from 'react-router-dom';
import { Mic } from 'lucide-react';

/**
 * Floating quick-access mic (fixed bottom-right), available across the
 * dashboard. Routes to the full Voice Assistant page. Hidden while already
 * on that page to avoid overlapping its own controls.
 */
export default function VoiceAssistantButton() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (pathname.startsWith('/dashboard/voice-assistant')) return null;

  return (
    <button
      onClick={() => navigate('/dashboard/voice-assistant')}
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-xl shadow-brand-500/40 transition hover:scale-105 active:scale-95"
      aria-label="Ouvrir l'assistant vocal"
      title="Assistant vocal"
    >
      <Mic className="h-6 w-6" />
    </button>
  );
}
