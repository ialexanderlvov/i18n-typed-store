import { useSyncExternalStore } from 'react';
import type { LocaleChangeResult, LocaleLoadOptions } from 'i18n-typed-store';
import { useI18nTypedStoreContext } from './useI18nTypedStoreContext';

/**
 * Hook for accessing and managing the current locale.
 * Returns the current locale and a function to change it.
 * Supports SSR/SSG by using useSyncExternalStore for proper hydration.
 * The type-safe setters accept configured locale keys. Explicit `FromTag`
 * setters accept arbitrary BCP 47 locale tags and resolve their best match.
 *
 * @template N - Type of namespaces object
 * @template L - Type of locales object
 * @template M - Type of translation modules mapping
 *
 * @returns Current locale plus typed-key and explicit BCP 47 tag setters
 *
 * @example
 * ```tsx
 * function LocaleSwitcher() {
 *   const { locale, setLocaleFromTag } = useI18nLocale();
 *   return (
 *     <select value={String(locale)} onChange={(e) => setLocaleFromTag(e.target.value)}>
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

	const updateLocaleFromTag = (locale: string) => {
		store.changeLocale(locale);
	};

	const updateLocaleAsync = (locale: keyof L, options?: LocaleLoadOptions<N>): Promise<LocaleChangeResult<L>> =>
		store.changeLocaleAsync(locale, options);

	const updateLocaleFromTagAsync = (locale: string, options?: LocaleLoadOptions<N>): Promise<LocaleChangeResult<L>> =>
		store.changeLocaleAsync(locale, options);

	return {
		locale,
		setLocale: updateLocale,
		setLocaleFromTag: updateLocaleFromTag,
		setLocaleAsync: updateLocaleAsync,
		setLocaleFromTagAsync: updateLocaleFromTagAsync,
	};
};
