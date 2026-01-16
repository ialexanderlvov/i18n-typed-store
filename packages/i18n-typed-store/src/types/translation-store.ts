/**
 * Translation store structure.
 * Manages translations for multiple namespace keys and locales.
 *
 * @template N - Type of namespaces object (e.g., { common: 'common', errors: 'errors' })
 * @template L - Type of locales object (e.g., { en: 'en', ru: 'ru' })
 * @template M - Type of translation modules mapping (e.g., { common: { greeting: string }, errors: { notFound: string } })
 */
export type TranslationStore<N extends Record<string, string>, L extends Record<string, string>, M extends { [K in keyof N]: any }> = {
	/** Currently active locale */
	currentLocale: keyof L;
	/** Available locales */
	locales: L;
	/** Namespaces map (namespace keys) */
	translationsMap: N;
	/**
	 * Adds a listener for locale change events.
	 *
	 * @param listener - Function to call when locale changes
	 */
	addChangeLocaleListener: (listener: (locale: keyof L) => void) => void;
	/**
	 * Removes a locale change listener.
	 *
	 * @param listener - Listener function to remove
	 */
	removeChangeLocaleListener: (listener: (locale: keyof L) => void) => void;
	/**
	 * Changes the current locale and notifies all listeners.
	 * Supports BCP 47 locale format (e.g., 'ru-RU', 'en-US', 'zh-Hans-CN').
	 * If the exact locale is not available, finds the best matching locale.
	 *
	 * @param locale - New locale key or BCP 47 locale string (e.g., 'ru-RU', 'en-US')
	 */
	changeLocale: (locale: string | keyof L) => void;
	/** Translations organized by namespace key */
	translations: {
		[K in keyof N]: {
			/** Currently active translation for this namespace */
			currentTranslation?: M[K];
			/** Locale of the current translation */
			currentLocale?: keyof L;
			/** Translations for all locales for this namespace */
			translations: Record<
				keyof L,
				{
					/** Loaded translation data, undefined if not loaded yet */
					namespace: M[K] | undefined;
					/** Whether translation is currently being loaded */
					isLoading: boolean;
					/** Whether an error occurred during loading */
					isError: boolean;
					/** Promise for the ongoing loading operation */
					loadingPromise?: Promise<void>;
				}
			>;
			/**
			 * Loads translation for a specific locale.
			 * Supports BCP 47 locale format (e.g., 'ru-RU', 'en-US', 'zh-Hans-CN').
			 * If the exact locale is not available, finds the best matching locale.
			 *
			 * @param locale - Locale key or BCP 47 locale string to load translation for
			 * @param fromCache - Whether to use cached translation if available (default: true)
			 * @returns Promise that resolves when translation is loaded
			 * @throws Error if loading fails
			 */
			load: (locale?: string | keyof L, fromCache?: boolean) => Promise<void>;
		};
	};
};
