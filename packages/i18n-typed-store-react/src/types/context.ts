import type { TranslationStore } from 'i18n-typed-store';

/**
 * Context passed to the load-error policy configured on the provider.
 *
 * `error` is the exact value rejected or thrown by the loader. It can be
 * `undefined`, because JavaScript promises may reject without a reason; the
 * policy is invoked based on the store's `isError` discriminator rather than
 * on the truthiness of this value.
 */
export type I18nLoadErrorContext<N extends Record<string, string>, L extends Record<string, string>> = {
	[K in keyof N]: {
		/** Exact value rejected or thrown by the translation loader. */
		error: unknown;
		/** Namespace whose active locale failed to load. */
		namespace: K;
		/** Locale whose load failed. */
		locale: keyof L;
		/** Whether the namespace has any last successfully activated translation. */
		hasPreviousTranslation: boolean;
		/** Whether translation data exists for the currently active locale. */
		hasActiveTranslation: boolean;
	};
}[keyof N];

/**
 * Controls whether a lazy translation load error reaches an Error Boundary
 * even when the hook can keep rendering previously loaded translation data.
 *
 * `true` always throws and `false` preserves available translation data. When
 * no translation can be returned at all, the lazy hook must still throw to
 * uphold its non-optional return type.
 */
export type ShouldThrowLoadError<N extends Record<string, string>, L extends Record<string, string>> =
	boolean | ((context: I18nLoadErrorContext<N, L>) => boolean);

/**
 * Context value for I18n typed store.
 * Provides access to translation store, locale management, and loading state.
 *
 * @template N - Type of namespaces object (e.g., { common: 'common', errors: 'errors' })
 * @template L - Type of locales object (e.g., { en: 'en', ru: 'ru' })
 * @template M - Type of translation modules mapping (e.g., { common: { greeting: string }, errors: { notFound: string } })
 */
export interface II18nTypedStoreContext<
	N extends Record<string, string> = Record<string, string>,
	L extends Record<string, string> = Record<string, string>,
	M extends { [K in keyof N]: any } = { [K in keyof N]: any },
> {
	/** Translation store instance */
	store: TranslationStore<N, L, M>;
	/**
	 * Suspense mode for translation loading:
	 * - 'once' - suspend only on first load
	 * - 'first-load-locale' - suspend on first load for each locale
	 * - 'change-locale' - suspend on every locale change
	 */
	suspenseMode: 'once' | 'first-load-locale' | 'change-locale';
	/** Optional policy for surfacing lazy-load failures through an Error Boundary. */
	shouldThrowLoadError?: ShouldThrowLoadError<N, L>;
}
