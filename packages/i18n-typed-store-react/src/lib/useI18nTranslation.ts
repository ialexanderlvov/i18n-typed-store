import { useMemo, useSyncExternalStore } from 'react';
import { useI18nTypedStoreContext } from './useI18nTypedStoreContext';

/**
 * Hook for accessing translations with automatic loading and locale change handling.
 * Returns undefined if translation is not yet loaded.
 *
 * State is read through useSyncExternalStore, so renders cannot tear under
 * concurrent rendering and no store update can be lost in the window between
 * render and subscription (React re-reads the snapshot right after subscribing).
 *
 * @template N - Type of namespaces object (e.g., { common: 'common', errors: 'errors' })
 * @template L - Type of locales object (e.g., { en: 'en', ru: 'ru' })
 * @template M - Type of translation modules mapping
 * @template K - Namespace key from namespaces object
 *
 * @param namespace - Namespace key to load translations for
 * @param fromCache - Whether to use cached translation if available (default: true)
 * @returns Translation object for the specified namespace, or undefined if not loaded
 *
 * @example
 * ```tsx
 * const translations = useI18nTranslation('common');
 * if (translations) {
 *   console.log(translations.greeting);
 * }
 * ```
 */
export const useI18nTranslation = <
	N extends Record<string, string>,
	L extends Record<string, string>,
	M extends { [K in keyof N]: any },
	K extends keyof N,
>(
	namespace: K,
	fromCache: boolean = true,
): M[K] | undefined => {
	const { store } = useI18nTypedStoreContext<N, L, M>();

	// Recreate the subscription/snapshot closures only when their inputs change,
	// so useSyncExternalStore resubscribes exactly when needed and not on every
	// render (an unstable `subscribe` identity would tear the subscription down
	// and set it up again each render).
	const [subscribe, getSnapshot] = useMemo(() => {
		/**
		 * The snapshot is the translation object for the *active* locale. It is a
		 * plain property read, so its identity is stable between calls until a
		 * load replaces the slot — exactly what useSyncExternalStore requires to
		 * avoid infinite re-render loops. Strictly returning the active locale's
		 * data (and not `currentTranslation`, which holds whatever was loaded
		 * last) means no stale-language text is ever served: consumers get
		 * undefined and can render a loader/skeleton while a switch is in flight.
		 */
		const getSnapshot = (): M[K] | undefined => store.translations[namespace].translations[store.currentLocale]?.namespace;

		const subscribe = (onStoreChange: () => void) => {
			let disposed = false;

			// Loads the active locale's translation and re-renders once it
			// settles. Failures are recorded by the store itself (`isError`);
			// this hook simply keeps returning undefined for the failed locale,
			// so the rejection is swallowed here instead of surfacing as an
			// unhandled promise rejection.
			const triggerLoad = () => {
				store.translations[namespace]
					.load(store.currentLocale, fromCache)
					.catch(() => undefined)
					.finally(() => {
						if (!disposed) {
							onStoreChange();
						}
					});
			};

			const listener = () => {
				// Re-render immediately — changeLocale() synchronously activates
				// the new locale when it is already cached...
				onStoreChange();
				// ...and fetch it when missing (or always, when caching is off).
				if (store.translations[namespace].translations[store.currentLocale]?.namespace === undefined || fromCache === false) {
					triggerLoad();
				}
			};
			store.addChangeLocaleListener(listener);

			// Initial load if the current locale's translation is missing.
			// Triggering it here (subscription setup, an effect) keeps the render
			// phase side-effect free.
			if (getSnapshot() === undefined) {
				triggerLoad();
			}

			return () => {
				disposed = true;
				store.removeChangeLocaleListener(listener);
			};
		};

		return [subscribe, getSnapshot] as const;
	}, [store, namespace, fromCache]);

	// The server snapshot mirrors the client one: whatever was preloaded via the
	// SSR utilities gets rendered, otherwise undefined (no loads run on the server).
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
