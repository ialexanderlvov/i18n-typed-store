import { Injectable, Inject } from '@nestjs/common';
import { I18N_STORE, I18N_OPTIONS } from '..';
import { I18nModuleOptions } from '../types/types';
import { getTranslation, type GetTranslationValue, type TranslationKeys, type TranslationStore } from 'i18n-typed-store';

/**
 * Service for working with internationalization in NestJS
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
	private currentLocale: keyof L;

	constructor(
		@Inject(I18N_STORE)
		private readonly store: TranslationStore<N, L, M>,
		@Inject(I18N_OPTIONS)
		private readonly options: I18nModuleOptions<N, L, M>,
	) {
		this.currentLocale = store.currentLocale;
	}

	/**
	 * Sets the current locale
	 *
	 * @param locale - Locale to set
	 */
	setLocale(locale: keyof L): void {
		if (!(locale in this.store.locales)) {
			throw new Error(`Invalid locale: '${String(locale)}' is not a valid locale key`);
		}
		this.currentLocale = locale;
		this.store.changeLocale(locale);
	}

	/**
	 * Gets the current locale
	 *
	 * @returns Current locale
	 */
	getLocale(): keyof L {
		return this.currentLocale;
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
		const targetLocale = locale || this.currentLocale;
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
		const targetLocale = locale || this.currentLocale;
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
	 * @param locale - Optional locale to use. If not provided, uses current locale
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
		return getTranslation(this.store, key, locale || this.currentLocale);
	}
}
