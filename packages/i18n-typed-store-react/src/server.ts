/**
 * Server-side entry point (`i18n-typed-store-react/server`).
 *
 * The main entry point is bundled with a "use client" directive because every
 * export there is a client-only React construct (Context, hooks). That
 * directive makes it unusable inside React Server Components and
 * `getServerSideProps`. This entry exposes the SSR utilities WITHOUT the
 * directive so they can be imported from server code:
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
