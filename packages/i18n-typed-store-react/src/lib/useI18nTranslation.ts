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
		 * The snapshot is the translation object committed for the store's current
		 * locale. It is a plain property read, so its identity is stable until a
		 * selected-locale load or locale commit replaces the current pointer —
		 * exactly what useSyncExternalStore requires to avoid infinite re-render
		 * loops. Strictly returning the current locale's committed data (and not
		 * the raw locale cache) means no stale-language text is ever served:
		 * consumers get undefined while a switch is in flight.
		 * It also keeps partial results from a failed atomic transition invisible.
		 */
		const getSnapshot = (): M[K] | undefined => {
			const namespaceEntry = store.translations[namespace];
			return namespaceEntry.currentLocale === store.currentLocale
				? (namespaceEntry.currentTranslation as M[K] | undefined)
				: undefined;
		};

		const subscribe = (onStoreChange: () => void) => {
			// Loads the current locale's translation and re-renders once it
			// settles. Failures are recorded by the store itself (`isError`);
			// this hook simply keeps returning undefined for the failed locale,
			// so the rejection is swallowed here instead of surfacing as an
			// unhandled promise rejection.
			const triggerLoad = () => {
				store.translations[namespace].load(store.currentLocale, fromCache).catch(() => undefined);
			};

			const localeListener: Parameters<typeof store.addChangeLocaleListener>[0] = (_locale, metadata) => {
				// Re-render immediately — changeLocale() synchronously activates
				// the new locale when it is already cached...
				onStoreChange();
				// A namespace that the atomic transaction itself force-refreshed needs
				// no second forced refresh after commit. Merely accepting a cached
				// namespace does not satisfy this hook's `fromCache=false` contract.
				const refreshedByAtomicChange =
					metadata.source === 'atomic' && metadata.fromCache === false && metadata.loadedNamespaces.includes(namespace);
				const namespaceEntry = store.translations[namespace];
				// Synchronous changes still fetch when missing (or always, when
				// caching is off), preserving the hook's established behaviour. A
				// scoped atomic commit also has to activate an excluded namespace's
				// preloaded cache when its committed pointer still belongs to the old
				// locale.
				if (
					!refreshedByAtomicChange &&
					(namespaceEntry.currentLocale !== store.currentLocale ||
						namespaceEntry.translations[store.currentLocale]?.namespace === undefined ||
						fromCache === false)
				) {
					triggerLoad();
				}
			};
			const unsubscribeTranslationState = store.subscribeTranslationState((event) => {
				if (event.namespace === namespace) {
					onStoreChange();
				}
			});
			store.addChangeLocaleListener(localeListener);

			// Initial load if the current locale's translation is missing.
			// Triggering it here (subscription setup, an effect) keeps the render
			// phase side-effect free.
			if (getSnapshot() === undefined || fromCache === false) {
				triggerLoad();
			}

			return () => {
				store.removeChangeLocaleListener(localeListener);
				unsubscribeTranslationState();
			};
		};

		return [subscribe, getSnapshot] as const;
	}, [store, namespace, fromCache]);

	// The server snapshot mirrors the client one: whatever was preloaded via the
	// SSR utilities gets rendered, otherwise undefined (no loads run on the server).
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
