import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect } from 'react';

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-5xl',
  full: 'max-w-6xl',
};

/**
 * Accessible modal with backdrop, escape-to-close, body scroll lock and vertical overflow scroll.
 */
export default function Modal({ open, isOpen, onClose, title, children, footer, size = 'md', className = '' }) {
  const isVisible = Boolean(open ?? isOpen);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    if (isVisible) {
      document.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isVisible, onClose]);

  const sizeClass = SIZES[size] || SIZES.md;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className={`card relative z-10 w-full ${sizeClass} max-h-[92vh] flex flex-col p-4 sm:p-6 shadow-2xl ${className}`}
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3 shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate pr-2">
                {title}
              </h3>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(92vh-110px)] pr-1 focus:outline-none">
              {children}
            </div>
            {footer && <div className="mt-4 flex justify-end gap-3 shrink-0 pt-3 border-t border-gray-100 dark:border-gray-800">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
