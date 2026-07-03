import type { TranslationStore } from '../types/translation-store.js';
import type { CreateTranslationStoreOptions } from '../types/create-translation-store.js';
import type { TranslationModuleMap } from '../types/create-translation-module-map.js';
import { createTranslationModuleMap } from './create-translation-module-map.js';

import { EventEmitter } from './event-emitter.js';
import { smartDeepMerge } from './smart-merge.js';
import { findBestLocaleMatch } from './locale-utils.js';
import { validateNonEmptyObject, validateFunction, validateKeyInObject } from './validate.js';

/**
 * Creates a translation store factory with typed translations for different locales.
 * The store supports lazy loading, caching, error handling, and fallback locale merging.
 *
 * @template N - Type of namespaces object (e.g., { common: 'common', errors: 'errors' })
 * @template L - Type of locales object (e.g., { en: 'en', ru: 'ru' })
 * @template Module - Type of the raw module loaded from the module loader
 *
 * @param options - Configuration options for the translation store
 * @returns Object with a `type()` method for creating a typed translation store
 * @throws {TypeError} If required options are invalid
 *
 * @example
 * ```ts
 * const namespaces = { common: 'common', errors: 'errors' } as const;
 * const locales = { en: 'en', ru: 'ru' } as const;
 *
 * const storeFactory = createTranslationStore({
 *   namespaces,
 *   locales,
 *   loadModule: async (locale, namespace) => import(`./${namespace}/${locale}.json`),
 *   extractTranslation: (module) => module.default || module,
 *   defaultLocale: 'en',
 *   useFallback: true,
 *   fallbackLocale: 'en',
 * });
 *
 * const store = storeFactory.type<{
 *   common: { greeting: string };
 *   errors: { notFound: string };
 * }>();
 * ```
 */
export const createTranslationStore = <N extends Record<string, string>, L extends Record<string, string>, Module = unknown>({
	namespaces,
	locales,
	loadModule,
	extractTranslation,
	deleteOtherLocalesAfterLoad = false,
	loadFromCache = true,
	defaultLocale,
	useFallback = false,
	fallbackLocale = defaultLocale,
	changeLocaleEventName = 'change-locale',
	onMissingKey,
}: CreateTranslationStoreOptions<N, L, Module>) => {
	// Validate inputs
	validateNonEmptyObject(namespaces, 'namespaces');
	validateNonEmptyObject(locales, 'locales');
	validateFunction(loadModule, 'loadModule');
	validateFunction(extractTranslation, 'extractTranslation');
	validateKeyInObject(defaultLocale, locales, 'defaultLocale', 'locales');
	if (useFallback) {
		validateKeyInObject(fallbackLocale, locales, 'fallbackLocale', 'locales');
	}

	/**
	 * Resolves an arbitrary locale value (exact key or BCP 47 tag) to a valid
	 * locale key, falling back to defaultLocale when nothing matches.
	 */
	const resolveLocale = (locale: string | keyof L): keyof L => {
		// `in` walks the prototype chain — guard against keys like
		// `__proto__` / `constructor` that would otherwise pass.
		if (Object.prototype.hasOwnProperty.call(locales, locale as PropertyKey)) {
			return locale as keyof L;
		}

		// Try to find best matching locale using BCP 47 matching
		const matchedLocale = findBestLocaleMatch(locale as string, locales);

		// If no match found, fall back to defaultLocale
		return matchedLocale ?? defaultLocale;
	};

	return {
		/**
		 * Creates a typed translation store.
		 * The store provides methods to load and access translations for each locale.
		 * When useFallback is enabled, translations are automatically merged with fallback locale.
		 *
		 * @template M - Type of translation modules mapping where each key corresponds to a key from namespaces
		 * @returns Store with methods to load translations for each locale
		 *
		 * @example
		 * ```ts
		 * const store = storeFactory.type<{
		 *   common: { greeting: string; goodbye: string };
		 *   errors: { notFound: string; unauthorized: string };
		 * }>();
		 *
		 * await store.common.load('ru');
		 * // If useFallback is true and 'ru' translation is missing some keys,
		 * // they will be filled from fallback locale (e.g., 'en')
		 * const greeting = store.common.translations.ru.namespace?.greeting;
		 * ```
		 */
		type: <M extends { [K in keyof N]: any }>(): TranslationStore<N, L, M> => {
			const namespaceModuleMap: TranslationModuleMap<N, L, Module> = createTranslationModuleMap(namespaces, locales, loadModule);
			const emitter = new EventEmitter();

			/**
			 * After the current locale changes, point every namespace whose new
			 * locale is already cached at that cached translation. Without this,
			 * `currentTranslation` / `getTranslation()` keep serving the previous
			 * locale even though the requested one is sitting in the cache.
			 * Namespaces without a cached translation intentionally keep the old
			 * one (no flash of missing keys) until `load()` completes.
			 */
			const refreshNamespacesForLocale = (locale: keyof L) => {
				for (const namespaceKey of Object.keys(namespaces) as (keyof N)[]) {
					const namespaceEntry = store.translations[namespaceKey];
					const localeState = namespaceEntry.translations[locale];
					if (localeState?.namespace !== undefined) {
						namespaceEntry.currentTranslation = localeState.namespace;
						namespaceEntry.currentLocale = locale;
					}
				}
			};

			const store = {
				currentLocale: defaultLocale,
				locales,
				translationsMap: namespaces,
				translations: {},
				onMissingKey,
				addChangeLocaleListener: (listener) => {
					emitter.on(changeLocaleEventName, listener);
				},
				removeChangeLocaleListener: (listener) => {
					emitter.off(changeLocaleEventName, listener);
				},
				changeLocale: (locale: keyof L) => {
					const resolvedLocale = resolveLocale(locale);
					store.currentLocale = resolvedLocale;
					refreshNamespacesForLocale(resolvedLocale);
					emitter.emit(changeLocaleEventName, resolvedLocale);
				},
			} as TranslationStore<N, L, M>;

			// Initialize store structure for each namespace key
			for (const namespaceKey of Object.keys(namespaces) as (keyof N)[]) {
				// Monotonic counter of load() calls for this namespace. Used to
				// detect that another load started while ours was in flight, so a
				// stale finisher never wipes a newer load's data (see
				// deleteOtherLocalesAfterLoad below).
				let loadGeneration = 0;

				/**
				 * Loads the fallback locale translation into its cache slot and
				 * returns it. Deduplicates against an in-flight fetch for the same
				 * locale. The stored `loadingPromise` REJECTS on failure — a
				 * concurrent `load(fallbackLocale)` deduping onto it must observe
				 * the failure instead of resolving successfully. This caller,
				 * however, swallows the failure: a broken fallback must not fail
				 * the main locale's load, the merge is simply skipped.
				 */
				const loadFallbackTranslation = async (): Promise<M[typeof namespaceKey] | undefined> => {
					const fallbackState = store.translations[namespaceKey].translations[fallbackLocale];

					if (fallbackState.namespace !== undefined) {
						return fallbackState.namespace;
					}

					let promise = fallbackState.loadingPromise;
					if (!promise) {
						fallbackState.isError = false;
						fallbackState.isLoading = true;

						promise = (async () => {
							// Defer the body one microtask so `loadingPromise` is
							// assigned before any user code (loadModule) runs.
							// Otherwise a synchronous throw would clear the slot in
							// `finally` BEFORE the assignment below re-populates it
							// with an already-rejected promise that never goes away.
							await Promise.resolve();
							try {
								const fallbackModule = await namespaceModuleMap[namespaceKey][fallbackLocale]();
								fallbackState.namespace = (await extractTranslation(
									fallbackModule,
									fallbackLocale,
									namespaceKey,
								)) as M[typeof namespaceKey];
							} catch (error) {
								fallbackState.isError = true;
								throw error;
							} finally {
								fallbackState.isLoading = false;
								fallbackState.loadingPromise = undefined;
							}
						})();

						fallbackState.loadingPromise = promise;
					}

					try {
						await promise;
					} catch (_) {
						// If fallback fails, continue with current translation only
					}

					return fallbackState.namespace;
				};

				store.translations[namespaceKey] = {
					currentTranslation: undefined,
					currentLocale: undefined,
					translations: Object.fromEntries(
						Object.keys(locales).map((localeKey) => [
							localeKey,
							{
								namespace: undefined,
								isLoading: false,
								isError: false,
								loadingPromise: undefined,
							},
						]),
					) as TranslationStore<N, L, M>['translations'][keyof N]['translations'],
					load: async (
						locale: string | keyof L = store.currentLocale || defaultLocale,
						fromCache: boolean = loadFromCache,
					): Promise<void> => {
						const resolvedLocale = resolveLocale(locale);
						const namespaceEntry = store.translations[namespaceKey];
						const namespaceState = namespaceEntry.translations[resolvedLocale];
						const generation = ++loadGeneration;

						// Deduplicate against an in-flight fetch for this locale.
						// Awaiting (rather than returning) the shared promise makes
						// its failure THIS caller's failure too, and lets us apply
						// this call's own post-condition afterwards: making the
						// result current. That matters when the in-flight fetch is
						// a bare fallback prefetch, which caches the translation
						// but intentionally does not touch `currentTranslation`.
						if (namespaceState.loadingPromise) {
							await namespaceState.loadingPromise;
							namespaceState.isError = false;
							namespaceEntry.currentTranslation = namespaceState.namespace;
							namespaceEntry.currentLocale = resolvedLocale;
							return;
						}

						// Check cache if enabled
						const shouldUseCache = namespaceState.namespace && fromCache !== false;
						if (shouldUseCache) {
							// Serving valid cached data — clear a stale error flag
							// left by a previously failed load so consumers don't
							// render error UI alongside a perfectly good translation.
							namespaceState.isError = false;
							namespaceEntry.currentTranslation = namespaceState.namespace;
							namespaceEntry.currentLocale = resolvedLocale;
							return;
						}

						// Reset error state and set loading state
						namespaceState.isError = false;
						namespaceState.isLoading = true;

						const loadingPromise = (async () => {
							// Defer the body one microtask — see the note in
							// loadFallbackTranslation for why assignment must win.
							await Promise.resolve();
							try {
								// Load current locale translation
								const loadedModule = await namespaceModuleMap[namespaceKey][resolvedLocale]();
								let currentTranslation = (await extractTranslation(
									loadedModule,
									resolvedLocale,
									namespaceKey,
								)) as M[typeof namespaceKey];

								// Load fallback if enabled and different from current locale
								if (useFallback && resolvedLocale !== fallbackLocale) {
									const fallbackTranslation = await loadFallbackTranslation();

									// Merge current with fallback using smart merge
									if (fallbackTranslation !== undefined) {
										currentTranslation = smartDeepMerge(
											currentTranslation,
											fallbackTranslation,
										) as M[typeof namespaceKey];
									}
								}

								namespaceState.namespace = currentTranslation;

								// Only the most recent load may clean up, and in-flight
								// locales are never wiped: a slower finisher would
								// otherwise delete data a concurrent load(otherLocale)
								// has just fetched (or is about to store).
								if (deleteOtherLocalesAfterLoad && generation === loadGeneration) {
									// Never wipe: the locale we just resolved, the locale
									// the user is currently viewing, or (when fallback is
									// enabled) the fallback locale — it was just
									// loaded/merged into this very load.
									const keep = new Set<keyof L>([resolvedLocale, store.currentLocale]);
									if (useFallback) {
										keep.add(fallbackLocale);
									}
									for (const otherLocaleKey of Object.keys(namespaceEntry.translations) as (keyof L)[]) {
										const otherState = namespaceEntry.translations[otherLocaleKey];
										if (!keep.has(otherLocaleKey) && !otherState.isLoading && !otherState.loadingPromise) {
											otherState.namespace = undefined;
										}
									}
								}
								namespaceEntry.currentTranslation = namespaceState.namespace;
								namespaceEntry.currentLocale = resolvedLocale;
							} catch (error) {
								namespaceState.isError = true;
								throw error;
							} finally {
								namespaceState.isLoading = false;
								namespaceState.loadingPromise = undefined;
							}
						})();

						namespaceState.loadingPromise = loadingPromise;

						return loadingPromise;
					},
				};
			}

			return store;
		},
	};
};
