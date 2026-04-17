import { useEffect, useReducer, useRef } from 'react';
import { useI18nTypedStoreContext } from './useI18nTypedStoreContext';

/**
 * Hook for accessing translations with automatic loading and locale change handling.
 * Returns undefined if translation is not yet loaded.
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

	const namespaceState = store.translations[namespace];
	const locale = store.currentLocale;
	const [, setUpdate] = useReducer(() => ({}), {});

	// Tracks whether the component is still mounted so we don't call setState
	// after unmount (otherwise async loads that resolve post-unmount log warnings).
	const mountedRef = useRef(true);
	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	useEffect(() => {
		let cancelled = false;

		const triggerLoad = async () => {
			try {
				await store.translations[namespace].load(store.currentLocale, fromCache);
			} finally {
				if (!cancelled && mountedRef.current) {
					setUpdate();
				}
			}
		};

		// Initial load if the current locale's translation is missing.
		if (!store.translations[namespace].translations[store.currentLocale].namespace) {
			void triggerLoad();
		}

		const listener = () => {
			void triggerLoad();
		};
		store.addChangeLocaleListener(listener);

		return () => {
			cancelled = true;
			store.removeChangeLocaleListener(listener);
		};
	}, [store, namespace, fromCache]);

	return namespaceState.translations[locale]?.namespace ?? namespaceState.currentTranslation;
};
