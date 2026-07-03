import { Injectable, Inject } from '@nestjs/common';
import { I18nModuleOptions } from '../types/types';
import {
	findBestLocaleMatch,
	getTranslation,
	type GetTranslationValue,
	type TranslationKeys,
	type TranslationStore,
} from 'i18n-typed-store';
import { I18N_OPTIONS, I18N_STORE } from './tokens';
import { getRequestLocale, i18nRequestStorage, setRequestLocale } from './request-context';

/**
 * Service for working with internationalization in NestJS
 *
 * Locale resolution order (most specific first):
 *  1. The `locale` argument explicitly passed to a method.
 *  2. The locale bound to the current request via AsyncLocalStorage
 *     (set by `I18nMiddleware` / `I18nInterceptor`).
 *  3. The default locale on the underlying store.
 *
 * Concurrency note: the underlying store keeps ONE shared
 * `currentTranslation` slot per namespace, overwritten by every `load()` from
 * any request. This service therefore NEVER reads shared slots when serving a
 * request — every read goes through the per-request locale straight into the
 * per-locale cache (`translations[namespace].translations[locale]`), which is
 * append-only and safe under concurrent traffic.
 *
 * @template N - Type of namespaces object
 * @template L - Type of locales object
 * @template M - Type of translation modules
 */
@Injectable()
export class I18nService<
	N extends Record<string, string> = Record<string, string>,
	L extends Record<string, string> = Record<string, string>,
	M extends { [K in keyof N]: any } = { [K in keyof N]: any },
> {
	constructor(
		@Inject(I18N_STORE)
		private readonly store: TranslationStore<N, L, M>,
		@Inject(I18N_OPTIONS)
		private readonly options: I18nModuleOptions<N, L, M>,
	) {}

	/**
	 * Resolves the effective locale for the current call.
	 * Per-request locale (AsyncLocalStorage) wins over the store-wide default.
	 */
	private resolveLocale(explicit?: keyof L | string): keyof L {
		if (explicit !== undefined && explicit !== null) {
			return this.toStoreKey(explicit);
		}
		const requestLocale = getRequestLocale();
		if (requestLocale !== undefined) {
			return this.toStoreKey(requestLocale);
		}
		return this.store.currentLocale;
	}

	/**
	 * Maps any locale value — an exact store key or a BCP 47 tag like `'en-US'` —
	 * to a real key of `store.locales`. The underlying store's `load()` performs
	 * the same BCP 47 resolution internally and caches under the *resolved* key,
	 * so callers MUST resolve here too; otherwise reading
	 * `translations[explicitTag]` lands on a non-existent key and throws.
	 * Falls back to the store's current locale when nothing matches.
	 */
	private toStoreKey(value: keyof L | string): keyof L {
		if (Object.prototype.hasOwnProperty.call(this.store.locales, value as PropertyKey)) {
			return value as keyof L;
		}
		const matched = findBestLocaleMatch(String(value), this.store.locales);
		return (matched ?? this.store.currentLocale) as keyof L;
	}

	/**
	 * Sets the active locale, scoped to where the call happens:
	 *
	 * - **Inside a request context** (middleware/interceptor bound
	 *   AsyncLocalStorage): changes ONLY this request's locale — identical to
	 *   `setRequestLocale()`. Parallel requests are unaffected, so this is safe
	 *   to call from controllers/services during a request.
	 * - **Outside a request context** (bootstrap, CLI, workers, cron): changes
	 *   the store-wide default locale via `store.changeLocale()`. This mutates
	 *   shared state and should only happen at boot or in single-request
	 *   scenarios.
	 *
	 * Accepts an exact store key or a BCP 47 tag that resolves to one
	 * (`'ru-RU'` → `'ru'`).
	 *
	 * @param locale - Locale key or BCP 47 tag to set
	 * @throws Error when the locale cannot be resolved to any store locale
	 */
	setLocale(locale: keyof L | string): void {
		let resolved: keyof L;
		if (Object.prototype.hasOwnProperty.call(this.store.locales, locale as PropertyKey)) {
			resolved = locale as keyof L;
		} else {
			const matched = findBestLocaleMatch(String(locale), this.store.locales);
			if (matched === null) {
				throw new Error(`Invalid locale: '${String(locale)}' is not a valid locale key`);
			}
			resolved = matched as keyof L;
		}

		// Request scope active → per-request change only (race-free).
		if (i18nRequestStorage.getStore()) {
			setRequestLocale(String(resolved));
			return;
		}

		// No request scope → global default (boot / CLI / worker semantics).
		this.store.changeLocale(resolved);
	}

	/**
	 * Sets the locale for the current request only (AsyncLocalStorage-bound).
	 * Safe to call from controllers, guards, or filters during a request —
	 * it will not bleed into other in-flight requests.
	 *
	 * No-op when called outside a request scope.
	 */
	setRequestLocale(locale: keyof L | string | undefined): void {
		setRequestLocale(locale === undefined ? undefined : String(locale));
	}

	/**
	 * Gets the effective locale for the current call site.
	 * Returns the per-request locale when running inside a request, otherwise
	 * falls back to the store's default.
	 */
	getLocale(): keyof L {
		return this.resolveLocale();
	}

	/**
	 * Gets available locales
	 *
	 * @returns Object with available locales
	 */
	getLocales(): L {
		return this.store.locales;
	}

	/**
	 * Loads translation for the specified namespace.
	 * Without an explicit `locale`, loads for the per-request locale
	 * (AsyncLocalStorage) or, outside a request, the store default.
	 *
	 * @param namespace - Namespace key
	 * @param locale - Locale (optional, uses the resolved current locale)
	 * @param fromCache - Whether to use cache (default: true)
	 * @returns Promise that resolves after loading
	 * @throws Error when the underlying module load fails
	 */
	async loadTranslation<K extends keyof N>(namespace: K, locale?: keyof L, fromCache?: boolean): Promise<void> {
		const targetLocale = this.resolveLocale(locale);
		await this.store.translations[namespace].load(targetLocale, fromCache);
	}

	/**
	 * Gets translation for the specified namespace, loading it when needed.
	 *
	 * Reads the per-locale cache slot directly (NOT the store's shared
	 * `currentTranslation`, which any concurrent request's `load()` may have
	 * pointed at another locale in the meantime).
	 *
	 * @param namespace - Namespace key
	 * @param locale - Locale (optional, uses the resolved current locale)
	 * @returns Translation object, or undefined if the load failed
	 */
	async getTranslation<K extends keyof N>(namespace: K, locale?: keyof L): Promise<M[K] | undefined> {
		const targetLocale = this.resolveLocale(locale);
		try {
			await this.loadTranslation(namespace, targetLocale);
		} catch {
			// The documented contract is `undefined` on a failed load — the
			// error state is still observable on the store
			// (`translations[namespace].translations[locale].isError`).
		}
		// `targetLocale` is a real store key (resolveLocale guarantees it), so
		// this index is always valid. `namespace` is undefined when the load
		// failed and nothing was cached before.
		return this.store.translations[namespace].translations[targetLocale].namespace;
	}

	/**
	 * Gets the already-loaded translation for the specified namespace and the
	 * *current* locale — per-request locale inside a request scope, the store
	 * default outside of one. Does not trigger loading.
	 *
	 * Implementation note: this intentionally does NOT read
	 * `store.translations[namespace].currentTranslation`. That slot is global
	 * shared state overwritten by every `load()` of every concurrent request —
	 * reading it here would return another request's locale under parallel
	 * traffic. The per-locale cache slot is race-free.
	 *
	 * @param namespace - Namespace key
	 * @returns Translation object or undefined if not loaded for the current locale
	 */
	getCurrentTranslation<K extends keyof N>(namespace: K): M[K] | undefined {
		const targetLocale = this.resolveLocale();
		return this.store.translations[namespace].translations[targetLocale]?.namespace;
	}

	/**
	 * Gets the translation store instance
	 *
	 * @returns Translation store instance
	 */
	getStore(): TranslationStore<N, L, M> {
		return this.store;
	}

	/**
	 * Gets a translation value by key from the translation store.
	 * The key can be in the format "namespace" (returns entire namespace object),
	 * "namespace.key" or "namespace.nested.key".
	 * If the translation is not found, returns the key as a string.
	 * The value can be of any type (string, number, function, object, etc.).
	 *
	 * @template Key - Translation key type (inferred from key parameter)
	 *
	 * @param key - Translation key: "namespace" (returns namespace object), "namespace.key" or "namespace.nested.key" (fully typed)
	 * @param locale - Optional locale to use. If not provided, uses the per-request locale (or store default outside a request).
	 * @returns Translation value (any type) or the key string if not found
	 *
	 * @example
	 * ```ts
	 * // Get entire namespace object
	 * const common = this.i18nService.t('common');
	 * // Returns: { greeting: string, count: number, ... }
	 *
	 * // Get specific value
	 * const greeting = this.i18nService.t('common.greeting');
	 * // Returns: string ("Hello")
	 *
	 * // Get nested value
	 * const saveButton = this.i18nService.t('common.buttons.save');
	 * // Returns: string ("Save")
	 *
	 * // Get with specific locale
	 * const greetingRu = this.i18nService.t('common.greeting', 'ru');
	 * // Returns: string ("Привет")
	 * ```
	 */
	getTranslationByKey<Key extends TranslationKeys<M>>(key: Key, locale?: keyof L): GetTranslationValue<M, Key> | Key {
		return getTranslation(this.store, key, this.resolveLocale(locale));
	}
}
