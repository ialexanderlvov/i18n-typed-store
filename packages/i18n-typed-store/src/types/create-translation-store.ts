/**
 * Options for creating a translation store.
 *
 * @template N - Type of namespaces object (e.g., { common: 'common', errors: 'errors' })
 * @template L - Type of locales object (e.g., { en: 'en', ru: 'ru' })
 * @template Module - Type of the raw module loaded from the module loader
 */
export interface CreateTranslationStoreOptions<N extends Record<string, string>, L extends Record<string, string>, Module = unknown> {
	/** Object with namespace keys */
	namespaces: N;
	/** Object with locale keys */
	locales: L;
	/** Function to load a translation module for a specific locale and namespace */
	loadModule: (locale: keyof L, namespace: keyof N) => Promise<Module>;
	/**
	 * Function to extract translation data from the loaded module.
	 * Receives three parameters: (module, locale, namespace) allowing for locale-specific
	 * or namespace-specific extraction logic.
	 */
	extractTranslation: (module: Module, locale: keyof L, namespace: keyof N) => unknown | Promise<unknown>;
	/**
	 * Whether to delete translations for other locales after loading a new one.
	 * Useful for memory-constrained environments.
	 * @default false
	 */
	deleteOtherLocalesAfterLoad?: boolean;
	/**
	 * Whether to load translations from cache by default.
	 * If false, will always reload even if translation is already cached.
	 * @default true
	 */
	loadFromCache?: boolean;
	/** Default locale key to use */
	defaultLocale: keyof L;
	/**
	 * Whether to use fallback locale for missing translations.
	 * When enabled, translations will be merged with fallback locale translations.
	 * @default false
	 */
	useFallback?: boolean;
	/**
	 * Fallback locale key to use when useFallback is true.
	 * If not provided, defaultLocale will be used as fallback.
	 * @default defaultLocale
	 */
	fallbackLocale?: keyof L;
	/**
	 * Event name for locale change events.
	 * @default 'change-locale'
	 */
	changeLocaleEventName?: string;
	/**
	 * Called by `getTranslation` when a key cannot be resolved (namespace not
	 * loaded, missing path, etc.) right before the key string is returned.
	 * Use it to report missing translations to logging/monitoring.
	 *
	 * @example
	 * ```ts
	 * onMissingKey: (key, locale) => console.warn(`[i18n] missing ${locale}:${key}`),
	 * ```
	 */
	onMissingKey?: (key: string, locale: string) => void;
}
