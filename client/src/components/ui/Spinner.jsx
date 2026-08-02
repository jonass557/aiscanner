import { Loader2 } from 'lucide-react';

/** Full-screen centered spinner used for route-level loading. */
export default function Spinner({ label = 'Loading...' }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-gray-500">
      <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
