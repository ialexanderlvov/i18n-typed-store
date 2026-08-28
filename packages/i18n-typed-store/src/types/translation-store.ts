/** Options shared by store-level locale loading operations. */
export interface LocaleLoadOptions<N extends Record<string, string> = Record<string, string>> {
	/** Whether already loaded namespace translations may be reused. */
	readonly fromCache?: boolean;
	/** Namespace keys to load. Every registered namespace is loaded by default. */
	readonly namespaces?: readonly (keyof N)[];
}

/** Immutable invalidation event for a namespace/locale translation state. */
export interface TranslationStateEvent<NamespaceKey extends PropertyKey = PropertyKey, LocaleKey extends PropertyKey = PropertyKey> {
	readonly namespace: NamespaceKey;
	readonly locale: LocaleKey;
}

/** Callback for namespace/locale translation state invalidations. */
export type TranslationStateListener<NamespaceKey extends PropertyKey = PropertyKey, LocaleKey extends PropertyKey = PropertyKey> = (
	event: TranslationStateEvent<NamespaceKey, LocaleKey>,
) => void;

/** Metadata describing how a locale change was committed. */
export type LocaleChangeMetadata<N extends Record<string, string> = Record<string, string>> =
	| {
			readonly source: 'sync';
			readonly loadedNamespaces: readonly [];
	  }
	| {
			readonly source: 'atomic';
			readonly loadedNamespaces: readonly (keyof N)[];
			/** Effective cache policy used by the atomic operation. */
			readonly fromCache: boolean;
	  };

/** Callback for committed locale changes. */
export type LocaleChangeListener<
	N extends Record<string, string> = Record<string, string>,
	L extends Record<string, string> = Record<string, string>,
> = (locale: keyof L, metadata: LocaleChangeMetadata<N>) => void;

/** Result of an atomic locale-change request. */
export type LocaleChangeResult<L extends Record<string, string>> =
	| {
			readonly status: 'committed';
			readonly locale: keyof L;
	  }
	| {
			readonly status: 'superseded';
			readonly locale: keyof L;
			readonly currentLocale: keyof L;
	  };

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
	addChangeLocaleListener: (listener: LocaleChangeListener<N, L>) => void;
	/**
	 * Removes a locale change listener.
	 *
	 * @param listener - Listener function to remove
	 */
	removeChangeLocaleListener: (listener: LocaleChangeListener<N, L>) => void;
	/**
	 * Subscribes to namespace/locale translation state invalidations.
	 * The returned function removes the listener.
	 */
	subscribeTranslationState: (listener: TranslationStateListener<keyof N, keyof L>) => () => void;
	/**
	 * Changes the current locale and notifies all listeners.
	 * Supports BCP 47 locale format (e.g., 'ru-RU', 'en-US', 'zh-Hans-CN').
	 * If the exact locale is not available, finds the best matching locale.
	 *
	 * @param locale - New locale key or BCP 47 locale string (e.g., 'ru-RU', 'en-US')
	 */
	changeLocale: (locale: string | keyof L) => void;
	/**
	 * Loads the requested namespaces for a locale without changing the active locale.
	 * Successful namespace loads are cached and can later be activated
	 * synchronously with `changeLocale`.
	 *
	 * @param locale - Locale key or BCP 47 locale string. Defaults to the current locale.
	 * @param options - Loading options
	 * @returns Promise that resolves after every namespace has loaded
	 * @throws LocaleLoadError containing every namespace failure
	 */
	preloadLocale: (locale?: string | keyof L, options?: LocaleLoadOptions<N>) => Promise<void>;
	/**
	 * Loads the requested namespaces for a locale and commits the locale only after all
	 * loads succeed. A failed authoritative request leaves the active locale and
	 * namespace pointers unchanged; a superseded request never commits its own
	 * target. Successful partial loads remain cached.
	 *
	 * @param locale - New locale key or BCP 47 locale string
	 * @param options - Loading options
	 * @returns Whether this request committed or was superseded by a newer locale request
	 * @throws LocaleLoadError containing every namespace failure
	 */
	changeLocaleAsync: (locale: string | keyof L, options?: LocaleLoadOptions<N>) => Promise<LocaleChangeResult<L>>;
	/**
	 * Optional handler invoked by `getTranslation` when a key resolves to
	 * nothing and the key string is about to be returned instead.
	 * Configured via `CreateTranslationStoreOptions.onMissingKey`.
	 */
	onMissingKey?: (key: string, locale: string) => void;
	/** Translations organized by namespace key */
	translations: {
		[K in keyof N]: {
			/** Last translation safely activated for this namespace. */
			currentTranslation?: M[K];
			/** Locale of `currentTranslation`. */
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
					/** Exact value rejected or thrown by the most recent failed load */
					error?: unknown;
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
