import { useEffect, useReducer } from 'react';
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
	const { store, suspenseMode } = useI18nTypedStoreContext<N, L, M>();

	const namespaceState = store.translations[namespace];
	const locale = store.currentLocale;
	const [_, setUpdate] = useReducer(() => ({}), {});

	const forceUpdate = () => {
		setUpdate();
	};

	const load = async (needUpdate: boolean) => {
		try {
			await store.translations[namespace].load(store.currentLocale, fromCache);
		} catch (error) {
			throw error;
		} finally {
			if (needUpdate) {
				forceUpdate();
			}
		}
	};

	useEffect(() => {
		const listener = () => {
			load(true);
		};
		store.addChangeLocaleListener(listener);
		return () => {
			store.removeChangeLocaleListener(listener);
		};
	}, [namespace, fromCache]);

	useEffect(() => {
		const namespaceState = store.translations[namespace];
		const locale = store.currentLocale;
		if (!namespaceState.translations[locale].namespace) {
			load(true);
		}
	}, [suspenseMode, namespace, fromCache, store.translations[namespace], store.currentLocale]);

	return namespaceState.translations[locale].namespace || namespaceState.currentTranslation;
};
