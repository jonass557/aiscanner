import { Loader2 } from 'lucide-react';

/**
 * Polymorphic button. `variant` picks the style, `loading` shows a spinner
 * and disables interaction. Renders as <button> by default.
 */
export default function Button({
  children,
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
  as: Component = 'button',
  ...props
}) {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    danger: 'btn bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-500/25',
  };

  return (
    <Component
      className={`${variants[variant] || variants.primary} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </Component>
  );
}
