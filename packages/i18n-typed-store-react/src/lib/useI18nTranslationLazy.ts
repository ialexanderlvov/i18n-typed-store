import { useEffect, useReducer } from 'react';
import { useI18nTypedStoreContext } from './useI18nTypedStoreContext';

/**
 * Hook for accessing translations with lazy loading and suspense support.
 * Throws a promise if translation is not yet loaded (for React Suspense).
 * Always returns a translation object (never undefined).
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
		const listener = (locale: keyof L) => {
			const namespaceState = store.translations[namespace];
			if ((suspenseMode === 'first-load-locale' || suspenseMode === 'change-locale') && namespaceState.currentLocale !== locale) {
				setUpdate();
				return;
			}
			load(true);
		};
		store.addChangeLocaleListener(listener);
		return () => {
			store.removeChangeLocaleListener(listener);
		};
	}, [namespace, suspenseMode, fromCache]);

	useEffect(() => {
		const namespaceState = store.translations[namespace];
		const locale = store.currentLocale;
		if (!namespaceState.translations[locale].namespace) {
			load(true);
		}
	}, [suspenseMode, namespace, fromCache, store.translations[namespace], store.currentLocale]);

	if (
		(!namespaceState.translations[locale].namespace && suspenseMode === 'first-load-locale') ||
		(suspenseMode === 'change-locale' && namespaceState.currentLocale !== locale)
	) {
		throw load(false);
	}

	if (!namespaceState.currentTranslation) {
		throw load(false);
	}

	return namespaceState.translations[locale].namespace || namespaceState.currentTranslation;
};
