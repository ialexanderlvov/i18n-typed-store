import { useMemo, useSyncExternalStore } from 'react';
import { isThenable } from './isThenable';
import { useI18nTypedStoreContext } from './useI18nTypedStoreContext';
import type { I18nLoadErrorContext } from '../types/context';
import {
	deleteSuspenseLoadRecord,
	getSuspenseLoadRecord,
	markSuspenseLoadRecordSuccessful,
	replaceSuspenseLoadRecord,
	scheduleCommittedSuspenseRecordCleanup,
	suspenseLoadOwnerKey,
	type SuspenseLoadOwner,
} from './suspenseLoadRecords';

/**
 * Immutable view of everything the render logic reads from the mutable store.
 * Snapshots are cached and reused while all fields are unchanged, giving
 * useSyncExternalStore the identity-stable value it requires.
 */
interface LazyTranslationSnapshot<T, LocaleKey> {
	/** Current locale of the store at snapshot time */
	locale: LocaleKey;
	/** Safely committed translation for the current locale, if any */
	active: T | undefined;
	/** Whether the last load for the current locale failed */
	isError: boolean;
	/** Exact value rejected or thrown by the last failed load */
	error: unknown;
	/** Last translation committed by the store; `lastLocale` identifies its locale */
	lastTranslation: T | undefined;
	/** Locale that `lastTranslation` belongs to */
	lastLocale: LocaleKey | undefined;
}

/**
 * Hook for accessing translations with lazy loading and Suspense support.
 * Throws a Promise if the translation is not yet loaded so React Suspense
 * can render the fallback. Always returns a translation object on resume;
 * if the very first load fails and no data exists at all, the load rejection
 * is thrown so an ErrorBoundary can catch it. Reasonless and thenable
 * rejection values are wrapped in a diagnostic Error at the React boundary.
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
 * @throws The load rejection (or its diagnostic wrapper) when loading failed and no translation exists at all
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
	const context = useI18nTypedStoreContext<N, L, M>();
	const { store, suspenseMode, shouldThrowLoadError } = context;
	const suspenseLoadOwner = (context as typeof context & { [suspenseLoadOwnerKey]?: SuspenseLoadOwner })[suspenseLoadOwnerKey];

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
				active: namespaceEntry.currentLocale === locale ? (namespaceEntry.currentTranslation as M[K] | undefined) : undefined,
				isError: localeState?.isError === true,
				error: localeState?.error,
				lastTranslation: namespaceEntry.currentTranslation as M[K] | undefined,
				lastLocale: namespaceEntry.currentLocale,
			};
			if (
				cached &&
				cached.locale === next.locale &&
				Object.is(cached.active, next.active) &&
				cached.isError === next.isError &&
				Object.is(cached.error, next.error) &&
				Object.is(cached.lastTranslation, next.lastTranslation) &&
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
				store.translations[namespace].load(store.currentLocale, fromCache).catch(() => undefined);
			};

			const localeListener: Parameters<typeof store.addChangeLocaleListener>[0] = (_locale, metadata) => {
				// Re-render immediately — changeLocale() synchronously activates
				// the new locale when it is already cached...
				notify();
				// Suppress a duplicate only when the atomic transaction force-refreshed
				// this namespace. A cached atomic commit does not satisfy this hook's
				// own `fromCache=false` contract.
				const refreshedByAtomicChange =
					metadata.source === 'atomic' && metadata.fromCache === false && metadata.loadedNamespaces.includes(namespace);
				const namespaceEntry = store.translations[namespace];
				// Synchronous changes preserve the existing fetch behaviour. A scoped
				// atomic commit must also activate an excluded namespace's preloaded
				// cache when its committed pointer still belongs to the old locale.
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
					notify();
				}
			});
			store.addChangeLocaleListener(localeListener);

			// Backfill if not loaded yet (e.g. right after a Suspense resume).
			const localeState = store.translations[namespace].translations[store.currentLocale];
			const suspenseLoadRecord = getSuspenseLoadRecord(localeState, suspenseLoadOwner);
			const resumedFromSuccessfulSuspenseLoad =
				suspenseLoadRecord?.status === 'success' && Object.is(suspenseLoadRecord.translation, localeState.namespace);
			if (resumedFromSuccessfulSuspenseLoad) {
				scheduleCommittedSuspenseRecordCleanup(localeState, suspenseLoadRecord);
			}
			const committedLocaleMismatch = store.translations[namespace].currentLocale !== store.currentLocale;
			if (
				localeState.namespace === undefined ||
				committedLocaleMismatch ||
				(fromCache === false && !resumedFromSuccessfulSuspenseLoad)
			) {
				triggerLoad();
			}

			return () => {
				disposed = true;
				store.removeChangeLocaleListener(localeListener);
				unsubscribeTranslationState();
			};
		};

		return [subscribe, getSnapshot] as const;
	}, [store, namespace, fromCache, suspenseLoadOwner]);

	const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
	const { locale, active, isError, error, lastTranslation, lastLocale } = snapshot;

	/**
	 * Starts (or joins — load() deduplicates) the load for the active locale
	 * and throws its promise for React Suspense, recording a failure so a
	 * later render can re-throw the actual error.
	 */
	const suspendOnLoad = (): never => {
		const localeState = store.translations[namespace].translations[locale];
		// `load()` synchronously invalidates translation state before returning its
		// promise. Defer that mutation until after React finishes the current render;
		// otherwise an already-mounted observer of this namespace is updated while
		// another component is rendering and React reports a cross-render update.
		// Multiple wrappers scheduled by concurrent renders still converge on the
		// core store's in-flight promise and therefore perform one physical load.
		const loadPromise = Promise.resolve().then(() => store.translations[namespace].load(locale, fromCache));
		// Server renders never install the subscription that consumes a successful
		// marker. Avoid retaining one timer/closure per request and namespace there;
		// the thrown promise alone is sufficient for streaming-capable renderers.
		if (typeof window === 'undefined') {
			throw loadPromise;
		}
		const record = replaceSuspenseLoadRecord(localeState, suspenseLoadOwner);
		loadPromise.then(
			() => {
				markSuspenseLoadRecordSuccessful(localeState, record, localeState.namespace);
			},
			() => {
				deleteSuspenseLoadRecord(localeState, record);
			},
		);
		throw loadPromise;
	};

	const hasActiveTranslation = active !== undefined;
	const hasPreviousTranslation = lastTranslation !== undefined;

	if (isError) {
		const context = {
			error,
			namespace,
			locale,
			hasPreviousTranslation,
			hasActiveTranslation,
		} as I18nLoadErrorContext<N, L>;
		const policyRequestsThrow =
			shouldThrowLoadError === true || (typeof shouldThrowLoadError === 'function' && shouldThrowLoadError(context));

		// Without any renderable translation the hook must throw regardless of an
		// explicitly permissive policy: returning undefined would violate M[K].
		if ((!hasActiveTranslation && !hasPreviousTranslation) || policyRequestsThrow) {
			// Preserve ordinary rejection values. `undefined` cannot give an Error
			// Boundary a useful value, while a thenable would be mistaken for a fresh
			// Suspense signal. Wrap only those two cases at the React throw boundary;
			// the exact reason remains available in core state and to the policy.
			if (error !== undefined && !isThenable(error)) {
				throw error;
			}
			const diagnosticError = new Error(
				`Failed to load translation for namespace "${String(namespace)}" and locale "${String(locale)}"`,
			);
			if (error !== undefined) {
				Object.defineProperty(diagnosticError, 'cause', { value: error, configurable: true });
			}
			throw diagnosticError;
		}

		// A permissive policy is only reachable when at least one renderable
		// translation exists; the no-data branch above always throws.
		if (hasActiveTranslation) {
			return active as M[K];
		}
		return lastTranslation as M[K];
	}

	// first-load-locale: suspend until THIS locale has loaded for the first time.
	if (suspenseMode === 'first-load-locale' && active === undefined) {
		suspendOnLoad();
	}

	// change-locale: suspend on every switch until the new locale becomes active.
	if (suspenseMode === 'change-locale' && lastLocale !== locale) {
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

	// No data exists and no load error was recorded: suspend until it arrives.
	// The error branch above either returned a safe translation or threw.
	return suspendOnLoad();
};
