import type { TranslationStore } from '../types/translation-store.js';
import type { TranslationKeys, GetTranslationValue } from '../types/translation-keys.js';
import { findBestLocaleMatch } from './locale-utils.js';

/**
 * Gets a translation value by key from the translation store.
 * The key can be in the format "namespace" (returns entire namespace object),
 * "namespace.key" or "namespace.nested.key".
 * If the translation is not found, returns the key as a string.
 * The value can be of any type (string, number, function, object, etc.).
 *
 * @template N - Type of namespaces object (e.g., { common: 'common', errors: 'errors' })
 * @template L - Type of locales object (e.g., { en: 'en', ru: 'ru' })
 * @template M - Type of translation modules mapping
 * @template Key - Translation key type (inferred from key parameter)
 *
 * @param store - Translation store instance
 * @param key - Translation key: "namespace" (returns namespace object), "namespace.key" or "namespace.nested.key" (fully typed)
 * @param locale - Optional locale to use. If not provided, uses store.currentLocale
 * @returns Translation value (any type) or the key string if not found
 *
 * @example
 * ```ts
 * const store = createTranslationStore({...}).type<{
 *   common: {
 *     greeting: string;
 *     count: number;
 *     handler: () => void;
 *     buttons: { save: string }
 *   };
 * }>();
 *
 * await store.translations.common.load('en');
 *
 * // Get entire namespace object
 * const common = getTranslation(store, 'common');
 * // Returns: { greeting: string, count: number, handler: () => void, buttons: { save: string } }
 *
 * // Get specific value
 * const greeting = getTranslation(store, 'common.greeting');
 * // Returns: string ("Hello")
 * // TypeScript infers type: string
 *
 * const count = getTranslation(store, 'common.count');
 * // Returns: number (42)
 * // TypeScript infers type: number
 *
 * const handler = getTranslation(store, 'common.handler');
 * // Returns: () => void
 * // TypeScript infers type: () => void
 *
 * const saveButton = getTranslation(store, 'common.buttons.save');
 * // Returns: string ("Save")
 *
 * const missing = getTranslation(store, 'common.missing.key');
 * // TypeScript error: Argument of type '"common.missing.key"' is not assignable
 * ```
 */
export function getTranslation<
	N extends Record<string, string>,
	L extends Record<string, string>,
	M extends { [K in keyof N]: any },
	Key extends TranslationKeys<M>,
>(store: TranslationStore<N, L, M>, key: Key, locale?: string | keyof L): GetTranslationValue<M, Key> | Key {
	if (!key || typeof key !== 'string') {
		return key as GetTranslationValue<M, Key>;
	}

	const parts = key.split('.');

	// Resolve the locale the same way `load`/`changeLocale` do: exact key
	// first, then BCP 47 best match (`en-US` → `en`). Without this, a tag
	// those methods happily accept would silently miss the lookup here and
	// return the key string. Falls back to the current locale when nothing
	// matches. `hasOwnProperty` (not `in`) keeps `__proto__`-style keys out.
	let targetLocale: keyof L;
	if (locale === undefined || locale === null || locale === '') {
		targetLocale = store.currentLocale;
	} else if (Object.prototype.hasOwnProperty.call(store.locales, locale as PropertyKey)) {
		targetLocale = locale as keyof L;
	} else {
		targetLocale = findBestLocaleMatch(String(locale), store.locales) ?? store.currentLocale;
	}

	const namespaceKey = parts[0] as keyof N;

	// Reports the miss (if a handler is configured) and returns the key —
	// the documented "not found" contract.
	const miss = (): GetTranslationValue<M, Key> => {
		store.onMissingKey?.(key, String(targetLocale));
		return key as GetTranslationValue<M, Key>;
	};

	// `in` walks the prototype chain, so a key like `__proto__` would
	// erroneously match. `hasOwnProperty` keeps the lookup to real namespaces.
	if (!Object.prototype.hasOwnProperty.call(store.translations, namespaceKey as PropertyKey)) {
		return miss();
	}

	const namespaceState = store.translations[namespaceKey];
	const translation = namespaceState.translations[targetLocale]?.namespace;

	if (!translation) {
		return miss();
	}

	if (parts.length === 1) {
		return translation as GetTranslationValue<M, Key>;
	}

	let value: any = translation;
	for (let i = 1; i < parts.length; i++) {
		if (value === null || value === undefined || typeof value !== 'object') {
			return miss();
		}
		const part = parts[i];
		if (part === undefined) {
			return miss();
		}
		// Only walk own enumerable properties. Without this guard, a key like
		// `common.toString` or `common.__proto__.constructor` would resolve
		// to inherited prototype members — leaking functions/objects to
		// callers that pass user-controlled keys into `t()`.
		if (!Object.prototype.hasOwnProperty.call(value, part)) {
			return miss();
		}
		value = value[part];
		if (value === undefined) {
			return miss();
		}
	}

	return value as GetTranslationValue<M, Key>;
}
