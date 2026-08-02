/**
 * Lightweight class-name combiner. Filters out falsy values and joins the
 * rest with spaces. Dependency-free to keep the bundle lean.
 * Usage: cn('px-2', condition && 'bg-red-500')
 */
export function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}
