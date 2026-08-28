import type {
	LocaleChangeListener,
	LocaleChangeMetadata,
	LocaleLoadOptions,
	TranslationStateEvent,
	TranslationStateListener,
	TranslationStore,
} from '../types/translation-store.js';
import type { CreateTranslationStoreOptions } from '../types/create-translation-store.js';
import type { TranslationModuleMap } from '../types/create-translation-module-map.js';
import { createTranslationModuleMap } from './create-translation-module-map.js';

import { smartDeepMerge } from './smart-merge.js';
import { findBestLocaleMatch } from './locale-utils.js';
import { LocaleLoadError } from './locale-load-error.js';
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
 *   extractTranslation: (module) => module.default ?? module,
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
		 * await store.translations.common.load('ru');
		 * // If useFallback is true and 'ru' translation is missing some keys,
		 * // they will be filled from fallback locale (e.g., 'en')
		 * const greeting = store.translations.common.translations.ru.namespace?.greeting;
		 * ```
		 */
		type: <M extends { [K in keyof N]: any }>(): TranslationStore<N, L, M> => {
			const namespaceModuleMap: TranslationModuleMap<N, L, Module> = createTranslationModuleMap(namespaces, locales, loadModule);
			type StoreLocaleChangeListener = LocaleChangeListener<N, L>;
			type StoreTranslationStateListener = TranslationStateListener<keyof N, keyof L>;
			const localeListeners = new Map<string, Set<StoreLocaleChangeListener>>();
			const translationStateListeners = new Set<StoreTranslationStateListener>();
			type NamespaceLoader = (locale?: string | keyof L, fromCache?: boolean, activateWhenCurrent?: boolean) => Promise<void>;
			const namespaceLoaders = {} as Record<keyof N, NamespaceLoader>;
			const namespaceKeys = Object.keys(namespaces) as (keyof N)[];
			let localeSelectionIntent = 0;
			type AtomicLocaleIntent = {
				readonly intent: number;
				readonly namespaces: ReadonlySet<keyof N>;
			};
			const activeAtomicLocaleIntents = new Map<keyof L, AtomicLocaleIntent>();
			const committedAtomicNamespaceIntents = new Map<keyof L, Map<keyof N, number>>();
			const namespaceActivationEpochs = new Map<keyof L, Map<keyof N, number>>();
			const protectedLocaleLoadCounts = new Map<keyof L, number>();
			let localeCommitVersion = 0;
			const reportListenerError = (error: unknown) => {
				queueMicrotask(() => {
					throw error;
				});
			};
			const notifyTranslationStateBatch = (
				events: readonly TranslationStateEvent<keyof N, keyof L>[],
				expectedCommitVersion?: number,
			) => {
				const isCurrentCommit = () => expectedCommitVersion === undefined || localeCommitVersion === expectedCommitVersion;
				for (const event of events) {
					if (!isCurrentCommit()) return false;
					// Match EventEmitter semantics: snapshot once per event, preserve
					// insertion order, and deduplicate identical listener references.
					for (const listener of [...translationStateListeners]) {
						if (!isCurrentCommit()) return false;
						try {
							listener(event);
						} catch (error) {
							reportListenerError(error);
						}
					}
				}
				return isCurrentCommit();
			};
			const notifyLocaleChange = (locale: keyof L, metadata: LocaleChangeMetadata<N>, expectedCommitVersion: number) => {
				const listeners = localeListeners.get(changeLocaleEventName);
				if (!listeners) return;
				for (const listener of [...listeners]) {
					if (localeCommitVersion !== expectedCommitVersion) return;
					try {
						listener(locale, metadata);
					} catch (error) {
						reportListenerError(error);
					}
				}
			};
			const getNamespaceActivationEpoch = (locale: keyof L, namespace: keyof N) =>
				namespaceActivationEpochs.get(locale)?.get(namespace) ?? 0;
			const bumpNamespaceActivationEpochs = (locale: keyof L, selectedNamespaceKeys: readonly (keyof N)[]) => {
				let localeEpochs = namespaceActivationEpochs.get(locale);
				if (!localeEpochs) {
					localeEpochs = new Map();
					namespaceActivationEpochs.set(locale, localeEpochs);
				}
				for (const namespaceKey of selectedNamespaceKeys) {
					localeEpochs.set(namespaceKey, (localeEpochs.get(namespaceKey) ?? 0) + 1);
				}
			};
			const protectLocaleCache = (locale: keyof L) => {
				protectedLocaleLoadCounts.set(locale, (protectedLocaleLoadCounts.get(locale) ?? 0) + 1);
			};
			const releaseLocaleCache = (locale: keyof L) => {
				const nextCount = (protectedLocaleLoadCounts.get(locale) ?? 1) - 1;
				if (nextCount === 0) protectedLocaleLoadCounts.delete(locale);
				else protectedLocaleLoadCounts.set(locale, nextCount);
			};
			const notifyTranslationState = (namespace: keyof N, locale: keyof L) => {
				notifyTranslationStateBatch([{ namespace, locale }], localeCommitVersion);
			};
			const resolveNamespaceKeys = (options?: LocaleLoadOptions<N>): readonly (keyof N)[] => {
				if (options?.namespaces === undefined) return namespaceKeys;
				if (!Array.isArray(options.namespaces)) {
					throw new TypeError('options.namespaces must be an array');
				}

				const resolvedNamespaces: (keyof N)[] = [];
				const seenNamespaces = new Set<keyof N>();
				for (const namespaceKey of options.namespaces) {
					validateKeyInObject(namespaceKey, namespaces, 'namespace', 'namespaces');
					if (!seenNamespaces.has(namespaceKey)) {
						seenNamespaces.add(namespaceKey);
						resolvedNamespaces.push(namespaceKey);
					}
				}
				return resolvedNamespaces;
			};

			/**
			 * After the current locale changes, point each requested namespace whose
			 * new locale is already cached at that cached translation. Without this,
			 * `currentTranslation` / `getTranslation()` keep serving the previous
			 * locale even though the requested one is sitting in the cache.
			 * Namespaces without a cached translation intentionally keep the old
			 * one (no flash of missing keys) until `load()` completes.
			 */
			const refreshNamespacesForLocale = (
				locale: keyof L,
				namespaceKeysToRefresh: readonly (keyof N)[],
			): TranslationStateEvent<keyof N, keyof L>[] => {
				const invalidations: TranslationStateEvent<keyof N, keyof L>[] = [];
				for (const namespaceKey of namespaceKeysToRefresh) {
					const namespaceEntry = store.translations[namespaceKey];
					const localeState = namespaceEntry.translations[locale];
					if (localeState?.namespace !== undefined) {
						namespaceEntry.currentTranslation = localeState.namespace;
						namespaceEntry.currentLocale = locale;
						invalidations.push({ namespace: namespaceKey, locale });
					}
				}
				return invalidations;
			};

			const commitLocale = (
				locale: keyof L,
				metadata: LocaleChangeMetadata<N>,
				namespaceKeysToRefresh: readonly (keyof N)[],
				cleanupAfterCommit: boolean = false,
			) => {
				store.currentLocale = locale;
				const invalidations = refreshNamespacesForLocale(locale, namespaceKeysToRefresh);
				if (cleanupAfterCommit && deleteOtherLocalesAfterLoad) {
					for (const namespaceKey of namespaceKeys) {
						const namespaceEntry = store.translations[namespaceKey];
						for (const localeKey of Object.keys(namespaceEntry.translations) as (keyof L)[]) {
							const localeState = namespaceEntry.translations[localeKey];
							const keepLocale =
								localeKey === locale ||
								(useFallback && localeKey === fallbackLocale) ||
								protectedLocaleLoadCounts.has(localeKey);
							if (
								!keepLocale &&
								!localeState.isLoading &&
								!localeState.loadingPromise &&
								localeState.namespace !== undefined
							) {
								localeState.namespace = undefined;
								invalidations.push({ namespace: namespaceKey, locale: localeKey });
							}
						}
					}
				}

				// The commit's entire mutable phase is complete before any user code
				// runs. A synchronous reentrant commit is therefore a later commit. It
				// increments the version and aborts the stale outer notification batch,
				// while this already-linearized operation still returns `committed`.
				const committedVersion = ++localeCommitVersion;
				const notificationsAreCurrent = notifyTranslationStateBatch(invalidations, committedVersion);
				if (notificationsAreCurrent) {
					notifyLocaleChange(locale, metadata, committedVersion);
				}
			};

			const loadNamespaces = async (
				locale: keyof L,
				selectedNamespaceKeys: readonly (keyof N)[],
				fromCache?: boolean,
			): Promise<void> => {
				const results = await Promise.allSettled(
					selectedNamespaceKeys.map((namespaceKey) => namespaceLoaders[namespaceKey](locale, fromCache, false)),
				);
				const failures = new Map<keyof N, unknown>();
				results.forEach((result, index) => {
					if (result.status === 'rejected') {
						const namespaceKey = selectedNamespaceKeys[index];
						if (namespaceKey !== undefined) failures.set(namespaceKey, result.reason);
					}
				});
				if (failures.size > 0) throw new LocaleLoadError(locale, failures);
			};

			const store = {
				currentLocale: defaultLocale,
				locales,
				translationsMap: namespaces,
				translations: {},
				onMissingKey,
				addChangeLocaleListener: (listener) => {
					let listeners = localeListeners.get(changeLocaleEventName);
					if (!listeners) {
						listeners = new Set();
						localeListeners.set(changeLocaleEventName, listeners);
					}
					listeners.add(listener);
				},
				removeChangeLocaleListener: (listener) => {
					const listeners = localeListeners.get(changeLocaleEventName);
					if (!listeners) return;
					listeners.delete(listener);
					if (listeners.size === 0) localeListeners.delete(changeLocaleEventName);
				},
				subscribeTranslationState: (listener) => {
					translationStateListeners.add(listener);
					return () => {
						translationStateListeners.delete(listener);
					};
				},
				changeLocale: (locale: string | keyof L) => {
					const resolvedLocale = resolveLocale(locale);
					localeSelectionIntent += 1;
					bumpNamespaceActivationEpochs(resolvedLocale, namespaceKeys);
					activeAtomicLocaleIntents.delete(resolvedLocale);
					commitLocale(resolvedLocale, { source: 'sync', loadedNamespaces: [] }, namespaceKeys);

					// A synchronous selection may supersede an atomic transition that is
					// already fetching this same locale. Joining only those existing
					// promises preserves changeLocale's no-network-load contract while
					// ensuring their eventual results become active for the newly selected
					// locale. Rejections are already represented in locale state.
					for (const namespaceKey of namespaceKeys) {
						const localeState = store.translations[namespaceKey].translations[resolvedLocale];
						if (localeState.loadingPromise) {
							void namespaceLoaders[namespaceKey](resolvedLocale, true, true).catch(() => undefined);
						}
					}
				},
				preloadLocale: async (locale: string | keyof L = store.currentLocale, options) => {
					const resolvedLocale = resolveLocale(locale);
					const selectedNamespaceKeys = resolveNamespaceKeys(options);
					protectLocaleCache(resolvedLocale);
					try {
						await loadNamespaces(resolvedLocale, selectedNamespaceKeys, options?.fromCache);
					} finally {
						releaseLocaleCache(resolvedLocale);
					}
				},
				changeLocaleAsync: async (locale: string | keyof L, options) => {
					const resolvedLocale = resolveLocale(locale);
					const selectedNamespaceKeys = resolveNamespaceKeys(options);
					const effectiveFromCache = options?.fromCache ?? loadFromCache;
					const intent = ++localeSelectionIntent;
					protectLocaleCache(resolvedLocale);
					bumpNamespaceActivationEpochs(resolvedLocale, selectedNamespaceKeys);
					activeAtomicLocaleIntents.set(resolvedLocale, {
						intent,
						namespaces: new Set(selectedNamespaceKeys),
					});
					try {
						try {
							await loadNamespaces(resolvedLocale, selectedNamespaceKeys, effectiveFromCache);
						} catch (error) {
							if (intent !== localeSelectionIntent) {
								return { status: 'superseded', locale: resolvedLocale, currentLocale: store.currentLocale };
							}
							throw error;
						}
						if (intent !== localeSelectionIntent) {
							return { status: 'superseded', locale: resolvedLocale, currentLocale: store.currentLocale };
						}
						let committedNamespaceIntents = committedAtomicNamespaceIntents.get(resolvedLocale);
						if (!committedNamespaceIntents) {
							committedNamespaceIntents = new Map();
							committedAtomicNamespaceIntents.set(resolvedLocale, committedNamespaceIntents);
						}
						for (const namespaceKey of selectedNamespaceKeys) {
							committedNamespaceIntents.set(namespaceKey, intent);
						}
						commitLocale(
							resolvedLocale,
							{ source: 'atomic', loadedNamespaces: [...selectedNamespaceKeys], fromCache: effectiveFromCache },
							selectedNamespaceKeys,
							true,
						);
						return { status: 'committed', locale: resolvedLocale };
					} finally {
						if (activeAtomicLocaleIntents.get(resolvedLocale)?.intent === intent) {
							activeAtomicLocaleIntents.delete(resolvedLocale);
						}
						releaseLocaleCache(resolvedLocale);
					}
				},
			} as TranslationStore<N, L, M>;

			// Initialize store structure for each namespace key
			for (const namespaceKey of Object.keys(namespaces) as (keyof N)[]) {
				// Monotonic counter of physical fetches for this namespace. Used to
				// detect that another fetch started while ours was in flight, so a
				// stale finisher never wipes a newer load's data (see
				// deleteOtherLocalesAfterLoad below).
				let fetchGeneration = 0;

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
						fallbackState.error = undefined;
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
								fallbackState.error = error;
								throw error;
							} finally {
								fallbackState.isLoading = false;
								fallbackState.loadingPromise = undefined;
								notifyTranslationState(namespaceKey, fallbackLocale);
							}
						})();

						fallbackState.loadingPromise = promise;
						notifyTranslationState(namespaceKey, fallbackLocale);
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
								error: undefined,
								loadingPromise: undefined,
							},
						]),
					) as TranslationStore<N, L, M>['translations'][keyof N]['translations'],
					load: undefined as unknown as TranslationStore<N, L, M>['translations'][typeof namespaceKey]['load'],
				};

				const cleanupCachedLocales = (resolvedLocale: keyof L): TranslationStateEvent<keyof N, keyof L>[] => {
					if (!deleteOtherLocalesAfterLoad) return [];
					const invalidations: TranslationStateEvent<keyof N, keyof L>[] = [];
					const namespaceEntry = store.translations[namespaceKey];
					const keep = new Set<keyof L>([resolvedLocale, store.currentLocale]);
					if (namespaceEntry.currentLocale !== undefined) keep.add(namespaceEntry.currentLocale);
					if (useFallback) keep.add(fallbackLocale);
					for (const protectedLocale of protectedLocaleLoadCounts.keys()) keep.add(protectedLocale);
					for (const otherLocaleKey of Object.keys(namespaceEntry.translations) as (keyof L)[]) {
						const otherState = namespaceEntry.translations[otherLocaleKey];
						if (
							!keep.has(otherLocaleKey) &&
							!otherState.isLoading &&
							!otherState.loadingPromise &&
							otherState.namespace !== undefined
						) {
							otherState.namespace = undefined;
							invalidations.push({ namespace: namespaceKey, locale: otherLocaleKey });
						}
					}
					return invalidations;
				};

				const loadNamespace: NamespaceLoader = async (
					locale: string | keyof L = store.currentLocale || defaultLocale,
					fromCache: boolean = loadFromCache,
					activateWhenCurrent: boolean = true,
				): Promise<void> => {
					const resolvedLocale = resolveLocale(locale);
					const namespaceEntry = store.translations[namespaceKey];
					const namespaceState = namespaceEntry.translations[resolvedLocale];
					const activationEpochAtStart = getNamespaceActivationEpoch(resolvedLocale, namespaceKey);
					const activeAtomicIntent = activeAtomicLocaleIntents.get(resolvedLocale);
					const atomicIntentAtStart = activeAtomicIntent?.namespaces.has(namespaceKey) ? activeAtomicIntent.intent : undefined;
					const shouldActivate = () =>
						activateWhenCurrent &&
						activationEpochAtStart === getNamespaceActivationEpoch(resolvedLocale, namespaceKey) &&
						store.currentLocale === resolvedLocale &&
						(atomicIntentAtStart === undefined ||
							committedAtomicNamespaceIntents.get(resolvedLocale)?.get(namespaceKey) === atomicIntentAtStart);
					const activateSelectedTranslation = () => {
						if (!shouldActivate()) return false;
						namespaceEntry.currentTranslation = namespaceState.namespace;
						namespaceEntry.currentLocale = resolvedLocale;
						return true;
					};

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
						namespaceState.error = undefined;
						const activated = activateSelectedTranslation();
						const invalidations = cleanupCachedLocales(resolvedLocale);
						if (activated) invalidations.push({ namespace: namespaceKey, locale: resolvedLocale });
						notifyTranslationStateBatch(invalidations, localeCommitVersion);
						return;
					}

					// Check cache if enabled
					const shouldUseCache = namespaceState.namespace !== undefined && fromCache !== false;
					if (shouldUseCache) {
						// Serving valid cached data — clear a stale error flag
						// left by a previously failed load so consumers don't
						// render error UI alongside a perfectly good translation.
						namespaceState.isError = false;
						namespaceState.error = undefined;
						activateSelectedTranslation();
						const invalidations = cleanupCachedLocales(resolvedLocale);
						invalidations.push({ namespace: namespaceKey, locale: resolvedLocale });
						notifyTranslationStateBatch(invalidations, localeCommitVersion);
						return;
					}

					// Reset error state and set loading state
					namespaceState.isError = false;
					namespaceState.error = undefined;
					namespaceState.isLoading = true;
					const generation = ++fetchGeneration;

					const loadingPromise = (async () => {
						let completionInvalidations: TranslationStateEvent<keyof N, keyof L>[] = [];
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
									currentTranslation = smartDeepMerge(currentTranslation, fallbackTranslation) as M[typeof namespaceKey];
								}
							}

							namespaceState.namespace = currentTranslation;
							activateSelectedTranslation();

							// Only the most recent load may clean up, and in-flight
							// locales are never wiped: a slower finisher would
							// otherwise delete data a concurrent load(otherLocale)
							// has just fetched (or is about to store).
							if (generation === fetchGeneration) {
								completionInvalidations = cleanupCachedLocales(resolvedLocale);
							}
						} catch (error) {
							namespaceState.isError = true;
							namespaceState.error = error;
							throw error;
						} finally {
							namespaceState.isLoading = false;
							namespaceState.loadingPromise = undefined;
							completionInvalidations.push({ namespace: namespaceKey, locale: resolvedLocale });
							notifyTranslationStateBatch(completionInvalidations, localeCommitVersion);
						}
					})();

					namespaceState.loadingPromise = loadingPromise;
					notifyTranslationState(namespaceKey, resolvedLocale);

					return loadingPromise;
				};

				namespaceLoaders[namespaceKey] = loadNamespace;
				store.translations[namespaceKey].load = (locale, fromCache) => loadNamespace(locale, fromCache, true);
			}

			return store;
		},
	};
};
