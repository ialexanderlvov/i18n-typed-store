import { useMemo, useSyncExternalStore } from 'react';
import { useI18nTypedStoreContext } from './useI18nTypedStoreContext';

interface I18nTranslationStateBase<Translation, LocaleKey extends PropertyKey> {
	/** Locale whose namespace state is exposed by this snapshot. */
	readonly locale: LocaleKey;
	/** Translation cached for `locale`, if it has been loaded. */
	readonly translation: Translation | undefined;
	/** Whether `locale` is currently being loaded for this namespace. */
	readonly isLoading: boolean;
	/** Last safely activated or committed translation in this namespace. */
	readonly currentTranslation: Translation | undefined;
	/** Locale that `currentTranslation` belongs to. */
	readonly currentLocale: LocaleKey | undefined;
}

/**
 * Read-only reactive state for one namespace and locale.
 *
 * `isError` is the authoritative discriminator because JavaScript promises
 * may reject with `undefined`. When it is true, `error` contains the exact
 * rejection value recorded by the core store.
 */
export type I18nTranslationState<Translation, LocaleKey extends PropertyKey> =
	| (I18nTranslationStateBase<Translation, LocaleKey> & {
			readonly isError: false;
			readonly error: undefined;
	  })
	| (I18nTranslationStateBase<Translation, LocaleKey> & {
			readonly isError: true;
			readonly error: unknown;
	  });

/**
 * Subscribes to the read-only load state of one translation namespace.
 *
 * Unlike `useI18nTranslation`, this hook never starts a load. It only reflects
 * work initiated through the store or another hook. Omitting `locale` follows
 * the store's current locale; passing one observes that cache slot explicitly.
 * `currentTranslation` remains the last safely committed fallback even while
 * a different locale is observed explicitly; `currentLocale` identifies it.
 *
 * @param namespace - Namespace whose state should be observed
 * @param locale - Optional locale to observe instead of the current store locale
 */
export const useI18nTranslationState = <
	N extends Record<string, string>,
	L extends Record<string, string>,
	M extends { [K in keyof N]: any },
	K extends keyof N,
>(
	namespace: K,
	locale?: keyof L,
): I18nTranslationState<M[K], keyof L> => {
	const { store } = useI18nTypedStoreContext<N, L, M>();
	type Snapshot = I18nTranslationState<M[K], keyof L>;

	const [subscribe, getSnapshot] = useMemo(() => {
		let cachedSnapshot: Snapshot | undefined;

		const getSnapshot = (): Snapshot => {
			const observedLocale = locale ?? store.currentLocale;
			const namespaceEntry = store.translations[namespace];
			const localeState = namespaceEntry.translations[observedLocale];
			const common = {
				locale: observedLocale,
				translation: localeState?.namespace as M[K] | undefined,
				isLoading: localeState?.isLoading === true,
				currentTranslation: namespaceEntry.currentTranslation as M[K] | undefined,
				currentLocale: namespaceEntry.currentLocale,
			};
			const nextSnapshot: Snapshot = localeState?.isError
				? { ...common, isError: true, error: localeState.error }
				: { ...common, isError: false, error: undefined };

			if (
				cachedSnapshot &&
				cachedSnapshot.locale === nextSnapshot.locale &&
				Object.is(cachedSnapshot.translation, nextSnapshot.translation) &&
				cachedSnapshot.isLoading === nextSnapshot.isLoading &&
				cachedSnapshot.isError === nextSnapshot.isError &&
				Object.is(cachedSnapshot.error, nextSnapshot.error) &&
				Object.is(cachedSnapshot.currentTranslation, nextSnapshot.currentTranslation) &&
				cachedSnapshot.currentLocale === nextSnapshot.currentLocale
			) {
				return cachedSnapshot;
			}

			cachedSnapshot = nextSnapshot;
			return nextSnapshot;
		};

		const subscribe = (onStoreChange: () => void) => {
			const localeListener = () => {
				onStoreChange();
			};
			const unsubscribeTranslationState = store.subscribeTranslationState((event) => {
				if (event.namespace === namespace) {
					onStoreChange();
				}
			});

			store.addChangeLocaleListener(localeListener);

			return () => {
				store.removeChangeLocaleListener(localeListener);
				unsubscribeTranslationState();
			};
		};

		return [subscribe, getSnapshot] as const;
	}, [store, namespace, locale]);

	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
