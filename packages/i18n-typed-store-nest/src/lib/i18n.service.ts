import { Injectable, Inject } from '@nestjs/common';
import { I18nModuleOptions } from '../types/types';
import { getTranslation, type GetTranslationValue, type TranslationKeys, type TranslationStore } from 'i18n-typed-store';
import { I18N_OPTIONS, I18N_STORE } from './tokens';
import { getRequestLocale, setRequestLocale } from './request-context';

/**
 * Service for working with internationalization in NestJS
 *
 * Locale resolution order (most specific first):
 *  1. The `locale` argument explicitly passed to a method.
 *  2. The locale bound to the current request via AsyncLocalStorage
 *     (set by `I18nMiddleware` / `I18nInterceptor`).
 *  3. The default locale on the underlying store.
 *
 * The per-request locale is the safe path under concurrent traffic. Setting
 * the locale via `setLocale()` mutates the global default and should only be
 * used at boot or in single-request CLI/worker scenarios.
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
			return explicit as keyof L;
		}
		const requestLocale = getRequestLocale();
		if (requestLocale && Object.prototype.hasOwnProperty.call(this.store.locales, requestLocale)) {
			return requestLocale as keyof L;
		}
		return this.store.currentLocale;
	}

	/**
	 * Sets the global default locale on the underlying store.
	 *
	 * **Warning:** this mutates shared state. In an HTTP server, prefer
	 * `setRequestLocale()` (or let the middleware/interceptor set it from the
	 * incoming request). Using `setLocale()` per request causes a race
	 * condition where parallel requests overwrite each other's locale.
	 *
	 * @param locale - Locale to set
	 */
	setLocale(locale: keyof L): void {
		if (!Object.prototype.hasOwnProperty.call(this.store.locales, locale as PropertyKey)) {
			throw new Error(`Invalid locale: '${String(locale)}' is not a valid locale key`);
		}
		this.store.changeLocale(locale);
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
	 * Loads translation for the specified namespace
	 *
	 * @param namespace - Namespace key
	 * @param locale - Locale (optional, uses current locale)
	 * @param fromCache - Whether to use cache (default: true)
	 * @returns Promise that resolves after loading
	 */
	async loadTranslation<K extends keyof N>(namespace: K, locale?: keyof L, fromCache?: boolean): Promise<void> {
		const targetLocale = this.resolveLocale(locale);
		await this.store.translations[namespace].load(targetLocale, fromCache);
	}

	/**
	 * Gets translation for the specified namespace
	 *
	 * @param namespace - Namespace key
	 * @param locale - Locale (optional, uses current locale)
	 * @returns Translation object or undefined if not loaded
	 */
	async getTranslation<K extends keyof N>(namespace: K, locale?: keyof L): Promise<M[K]> {
		const targetLocale = this.resolveLocale(locale);
		await this.loadTranslation(namespace, targetLocale);
		return this.store.translations[namespace].translations[targetLocale].namespace!;
	}

	/**
	 * Gets current translation for the specified namespace
	 *
	 * @param namespace - Namespace key
	 * @returns Translation object or undefined if not loaded
	 */
	getCurrentTranslation<K extends keyof N>(namespace: K): M[K] | undefined {
		return this.store.translations[namespace].currentTranslation;
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
	getTranslationByKey<Key extends TranslationKeys<M>>(key: Key, locale?: keyof L): GetTranslationValue<M, Key> {
		return getTranslation(this.store, key, this.resolveLocale(locale));
	}
}
