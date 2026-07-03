import { useMemo, useSyncExternalStore } from 'react';
import { useI18nTypedStoreContext } from './useI18nTypedStoreContext';

/**
 * Last load error per locale slot, keyed by the store's per-locale state
 * object (whose identity is stable for the lifetime of the store). The store
 * itself only records a boolean `isError`, but when the very first load fails
 * and there is nothing at all to render, this hook must throw the ACTUAL
 * error so an ErrorBoundary can display it. A module-level WeakMap survives
 * Suspense retries — hook state does not, because a component that suspends
 * on its first render is mounted again from scratch.
 */
const lastLoadErrors = new WeakMap<object, unknown>();

/**
 * Immutable view of everything the render logic reads from the mutable store.
 * Snapshots are cached and reused while all fields are unchanged, giving
 * useSyncExternalStore the identity-stable value it requires.
 */
interface LazyTranslationSnapshot<T, LocaleKey> {
	/** Active locale of the store at snapshot time */
	locale: LocaleKey;
	/** Loaded translation for the active locale, if any */
	active: T | undefined;
	/** Whether the last load for the active locale failed */
	isError: boolean;
	/** Last successfully activated translation for this namespace (any locale) */
	lastTranslation: T | undefined;
	/** Locale that `lastTranslation` belongs to */
	lastLocale: LocaleKey | undefined;
}

/**
 * Hook for accessing translations with lazy loading and Suspense support.
 * Throws a Promise if the translation is not yet loaded so React Suspense
 * can render the fallback. Always returns a translation object on resume;
 * if the very first load fails and no data exists at all, the load error
 * itself is thrown so an ErrorBoundary can catch it.
 *
 * State is read through useSyncExternalStore, so renders cannot tear under
 * concurrent rendering and no store update can be lost in the window between
 * render and subscription. The Suspense mechanics (throwing the load promise)
 * run in the render phase on top of the snapshot.
 *
 * Suspense modes (set on the provider):
 * - 'once' - suspend only until the first translation is available; later
 *   locale switches keep rendering the previous translation while the new
 *   locale loads in the background
 * - 'first-load-locale' - suspend on the first load of each locale
 * - 'change-locale' - suspend on every locale change
 *
 * @template N - Type of namespaces object (e.g., { common: 'common', errors: 'errors' })
 * @template L - Type of locales object (e.g., { en: 'en', ru: 'ru' })
 * @template M - Type of translation modules mapping
 * @template K - Namespace key from namespaces object
 *
 * @param namespace - Namespace key to load translations for
 * @param fromCache - Whether to use cached translation if available (default: true)
 * @returns Translation object for the specified namespace (never undefined)
 * @throws Promise if translation is not yet loaded (for React Suspense)
 * @throws The load error when loading failed and no translation exists at all
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const translations = useI18nTranslationLazy('common');
 *   return <div>{translations.greeting}</div>;
 * }
 *
 * function App() {
 *   return (
 *     <Suspense fallback={<Loading />}>
 *       <MyComponent />
 *     </Suspense>
 *   );
 * }
 * ```
 */
export const useI18nTranslationLazy = <
	N extends Record<string, string>,
	L extends Record<string, string>,
	M extends { [K in keyof N]: any },
	K extends keyof N,
>(
	namespace: K,
	fromCache: boolean = true,
): M[K] => {
	const { store, suspenseMode } = useI18nTypedStoreContext<N, L, M>();

	type Snapshot = LazyTranslationSnapshot<M[K], keyof L>;

	// Recreate the subscription/snapshot closures only when their inputs change,
	// so useSyncExternalStore resubscribes exactly when needed.
	const [subscribe, getSnapshot] = useMemo(() => {
		let cached: Snapshot | undefined;

		/**
		 * Reads the store and returns a snapshot. The previous snapshot object is
		 * reused while every field is unchanged — returning a fresh object each
		 * call would make useSyncExternalStore re-render in an infinite loop.
		 * Comparison-based caching also needs no explicit invalidation: loads
		 * that complete without an event are picked up on the next read.
		 */
		const getSnapshot = (): Snapshot => {
			const namespaceEntry = store.translations[namespace];
			const locale = store.currentLocale as keyof L;
			const localeState = namespaceEntry.translations[locale];
			const next: Snapshot = {
				locale,
				active: localeState?.namespace as M[K] | undefined,
				isError: localeState?.isError === true,
				lastTranslation: namespaceEntry.currentTranslation as M[K] | undefined,
				lastLocale: namespaceEntry.currentLocale,
			};
			if (
				cached &&
				cached.locale === next.locale &&
				cached.active === next.active &&
				cached.isError === next.isError &&
				cached.lastTranslation === next.lastTranslation &&
				cached.lastLocale === next.lastLocale
			) {
				return cached;
			}
			cached = next;
			return next;
		};

		const subscribe = (onStoreChange: () => void) => {
			let disposed = false;

			const notify = () => {
				if (!disposed) {
					onStoreChange();
				}
			};

			// Background load for the active locale. Primarily drives 'once'
			// mode (which never suspends after first data), but is harmless in
			// the other modes too: load() deduplicates in-flight fetches, so
			// this never double-fetches what the render-phase throw started.
			// Failures are recorded for the render logic and reflected in the
			// store's `isError`, hence the rejection is handled here and never
			// escapes as an unhandled promise rejection.
			const triggerLoad = () => {
				const localeState = store.translations[namespace].translations[store.currentLocale];
				store.translations[namespace]
					.load(store.currentLocale, fromCache)
					.catch((error: unknown) => {
						if (localeState) {
							lastLoadErrors.set(localeState, error);
						}
					})
					.finally(notify);
			};

			const listener = () => {
				// Re-render immediately — changeLocale() synchronously activates
				// the new locale when it is already cached...
				notify();
				// ...and fetch it when missing (or always, when caching is off).
				if (store.translations[namespace].translations[store.currentLocale]?.namespace === undefined || fromCache === false) {
					triggerLoad();
				}
			};
			store.addChangeLocaleListener(listener);

			// Backfill if not loaded yet (e.g. right after a Suspense resume).
			if (store.translations[namespace].translations[store.currentLocale]?.namespace === undefined) {
				triggerLoad();
			}

			return () => {
				disposed = true;
				store.removeChangeLocaleListener(listener);
			};
		};

		return [subscribe, getSnapshot] as const;
	}, [store, namespace, fromCache]);

	const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
	const { locale, active, isError, lastTranslation, lastLocale } = snapshot;

	/**
	 * Starts (or joins — load() deduplicates) the load for the active locale
	 * and throws its promise for React Suspense, recording a failure so a
	 * later render can re-throw the actual error.
	 */
	const suspendOnLoad = (): never => {
		const localeState = store.translations[namespace].translations[locale];
		const loadPromise = store.translations[namespace].load(locale, fromCache);
		loadPromise.catch((error: unknown) => {
			if (localeState) {
				lastLoadErrors.set(localeState, error);
			}
		});
		throw loadPromise;
	};

	// Never re-throw a load promise for a locale whose last load errored: each
	// throw starts a fresh failing load, which React would retry forever (an
	// infinite Suspense loop). Errors degrade to the last good translation, or
	// are re-thrown as errors, below.

	// first-load-locale: suspend until THIS locale has loaded for the first time.
	if (suspenseMode === 'first-load-locale' && active === undefined && !isError) {
		suspendOnLoad();
	}

	// change-locale: suspend on every switch until the new locale becomes active.
	if (suspenseMode === 'change-locale' && lastLocale !== locale && !isError) {
		suspendOnLoad();
	}

	if (active !== undefined) {
		return active;
	}

	// once: suspend only while there is no data AT ALL. Once anything has been
	// rendered, later locale switches keep showing the previous translation
	// while the new locale loads in the background (the subscription re-renders
	// this component when it lands).
	if (suspenseMode === 'once' && lastTranslation !== undefined) {
		return lastTranslation;
	}

	// Reuse `currentTranslation` only when it actually belongs to the active
	// locale — returning a *different* locale's data here would render stale,
	// wrong-language text after a locale switch.
	if (lastTranslation !== undefined && lastLocale === locale) {
		return lastTranslation;
	}

	// No data for the active locale yet and no error: suspend until it arrives
	// (requires a <Suspense> boundary).
	if (!isError) {
		suspendOnLoad();
	}

	// The load failed but an earlier translation exists — degrade to the last
	// good value instead of looping through failing loads.
	if (lastTranslation !== undefined) {
		return lastTranslation;
	}

	// No data at all and the load failed: throw the load error itself so an
	// ErrorBoundary catches it — returning undefined here would violate the
	// M[K] contract this hook promises.
	const failedState = store.translations[namespace].translations[locale];
	if (failedState && lastLoadErrors.has(failedState)) {
		throw lastLoadErrors.get(failedState);
	}
	throw new Error(`Failed to load translation for namespace "${String(namespace)}" and locale "${String(locale)}"`);
};
