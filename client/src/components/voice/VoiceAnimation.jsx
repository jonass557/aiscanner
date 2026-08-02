import { motion } from 'framer-motion';

/**
 * Animated equalizer bars for the voice assistant.
 * - listening: fast, tall pulse (brand color)
 * - speaking: gentler wave (accent color)
 * - idle: flat, dimmed
 */
export default function VoiceAnimation({ state = 'idle', bars = 5 }) {
  const active = state === 'listening' || state === 'speaking';
  const color =
    state === 'listening'
      ? 'bg-brand-500'
      : state === 'speaking'
        ? 'bg-accent-500'
        : 'bg-gray-300 dark:bg-gray-600';
  const duration = state === 'listening' ? 0.5 : 0.8;

  return (
    <div className="flex h-12 items-center justify-center gap-1.5" aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <motion.span
          key={i}
          className={`w-1.5 rounded-full ${color}`}
          animate={
            active
              ? { height: ['30%', '100%', '45%', '80%', '30%'] }
              : { height: '30%' }
          }
          transition={
            active
              ? { duration, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }
              : { duration: 0.2 }
          }
          style={{ height: '30%' }}
        />
      ))}
    </div>
  );
}
