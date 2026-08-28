/**
 * Server-side entry point (`i18n-typed-store-react/server`).
 *
 * The main entry point is bundled with a "use client" directive because it
 * contains React context, hooks, and components. That directive makes the
 * whole entry unsuitable for React Server Components and server-only modules.
 * SSR utilities are exposed exclusively from this entry, without the
 * directive:
 *
 * @example
 * ```ts
 * // app/layout.tsx (React Server Component) or getServerSideProps
 * import { getLocaleFromRequest, initializeStore } from 'i18n-typed-store-react/server';
 * ```
 */
export * from './lib/ssr';

// Re-export the framework-agnostic core so server code can create and preload
// stores without pulling in the client-marked bundle.
export * from 'i18n-typed-store';
