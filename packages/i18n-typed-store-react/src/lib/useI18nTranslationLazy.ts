import { useEffect, useReducer, useRef } from 'react';
import { useI18nTypedStoreContext } from './useI18nTypedStoreContext';

/**
 * Hook for accessing translations with lazy loading and Suspense support.
 * Throws a Promise if the translation is not yet loaded so React Suspense
 * can render the fallback. Always returns a translation object on resume.
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
	const [, setUpdate] = useReducer(() => ({}), {});

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

		const listener = (changedLocale: keyof L) => {
			const ns = store.translations[namespace];
			// In suspense modes that show a fallback on locale change, just
			// re-render so the throw path runs and Suspense kicks in.
			if ((suspenseMode === 'first-load-locale' || suspenseMode === 'change-locale') && ns.currentLocale !== changedLocale) {
				if (!cancelled && mountedRef.current) {
					setUpdate();
				}
				return;
			}
			void triggerLoad();
		};
		store.addChangeLocaleListener(listener);

		// Backfill if not loaded yet (after Suspense resumes).
		if (!store.translations[namespace].translations[store.currentLocale].namespace) {
			void triggerLoad();
		}

		return () => {
			cancelled = true;
			store.removeChangeLocaleListener(listener);
		};
	}, [store, namespace, fromCache, suspenseMode]);

	if (
		(!namespaceState.translations[locale]?.namespace && suspenseMode === 'first-load-locale') ||
		(suspenseMode === 'change-locale' && namespaceState.currentLocale !== locale)
	) {
		// Suspend until the load resolves; React will re-render after.
		throw store.translations[namespace].load(locale, fromCache);
	}

	if (!namespaceState.currentTranslation) {
		throw store.translations[namespace].load(locale, fromCache);
	}

	return (namespaceState.translations[locale]?.namespace ?? namespaceState.currentTranslation) as M[K];
};
