import { useSyncExternalStore } from 'react';
import { useI18nTypedStoreContext } from './useI18nTypedStoreContext';

/**
 * Hook for accessing and managing the current locale.
 * Returns the current locale and a function to change it.
 * Supports SSR/SSG by using useSyncExternalStore for proper hydration.
 * Supports BCP 47 locale format (e.g., 'ru-RU', 'en-US', 'zh-Hans-CN').
 * If the exact locale is not available, finds the best matching locale.
 *
 * @template N - Type of namespaces object
 * @template L - Type of locales object
 * @template M - Type of translation modules mapping
 *
 * @returns Object with current locale and setLocale function
 *
 * @example
 * ```tsx
 * function LocaleSwitcher() {
 *   const { locale, setLocale } = useI18nLocale();
 *   return (
 *     <select value={locale} onChange={(e) => setLocale(e.target.value)}>
 *       <option value="en">English</option>
 *       <option value="ru">Русский</option>
 *       <option value="ru-RU">Русский (Россия)</option>
 *       <option value="en-US">English (USA)</option>
 *     </select>
 *   );
 * }
 * ```
 */
export const useI18nLocale = <N extends Record<string, string>, L extends Record<string, string>, M extends { [K in keyof N]: any }>() => {
	const { store } = useI18nTypedStoreContext<N, L, M>();

	// Use useSyncExternalStore for proper SSR/SSG hydration
	const locale = useSyncExternalStore(
		(notify) => {
			const listener = () => {
				notify();
			};
			store.addChangeLocaleListener(listener);
			return () => {
				store.removeChangeLocaleListener(listener);
			};
		},
		() => store.currentLocale,
		() => store.currentLocale, // Server snapshot (same as client for initial render)
	);

	const updateLocale = (locale: keyof L) => {
		store.changeLocale(locale);
	};

	return { locale, setLocale: updateLocale };
};
