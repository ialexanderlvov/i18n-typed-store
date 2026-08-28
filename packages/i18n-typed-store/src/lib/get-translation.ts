import type { TranslationStore } from '../types/translation-store.js';
import type { TranslationKeys, GetTranslationValue } from '../types/translation-keys.js';
import { findBestLocaleMatch } from './locale-utils.js';

/**
 * Error thrown by `getTranslationOrThrow` when a key cannot be resolved.
 * Carries the requested key and the locale the lookup ran against, so
 * callers can report or handle the miss programmatically.
 */
export class TranslationMissingError extends Error {
	/** The translation key that failed to resolve */
	readonly key: string;
	/** The locale the lookup ran against */
	readonly locale: string;

	constructor(key: string, locale: string) {
		super(`Translation not found for key "${key}" (locale "${locale}")`);
		this.name = 'TranslationMissingError';
		this.key = key;
		this.locale = locale;
	}
}

/** Internal sentinel distinguishing "not found" from legitimate values. */
const MISSING: unique symbol = Symbol('i18n-typed-store.missing');

/**
 * Shared lookup used by `getTranslation` and `getTranslationOrThrow`.
 * An omitted locale reads only the namespace translation safely committed for
 * the store's current locale. An explicit locale reads that locale's raw cache
 * slot (exact key first, then BCP 47 best match). Returns the MISSING sentinel
 * on any miss so callers decide how to surface it.
 */
function lookupTranslation<N extends Record<string, string>, L extends Record<string, string>, M extends { [K in keyof N]: any }>(
	store: TranslationStore<N, L, M>,
	key: string,
	locale?: string | keyof L,
): { value: unknown | typeof MISSING; targetLocale: keyof L } {
	const parts = key.split('.');
	const useCommittedTranslation = locale === undefined || locale === null || locale === '';

	// Resolve the locale the same way `load`/`changeLocale` do: exact key
	// first, then BCP 47 best match (`en-US` → `en`). An omitted or unmatched
	// locale resolves to the current locale. `hasOwnProperty` (not `in`) keeps
	// `__proto__`-style keys out.
	let targetLocale: keyof L;
	if (useCommittedTranslation) {
		targetLocale = store.currentLocale;
	} else if (Object.prototype.hasOwnProperty.call(store.locales, locale as PropertyKey)) {
		targetLocale = locale as keyof L;
	} else {
		targetLocale = findBestLocaleMatch(String(locale), store.locales) ?? store.currentLocale;
	}

	const namespaceKey = parts[0] as keyof N;

	// `in` walks the prototype chain, so a key like `__proto__` would
	// erroneously match. `hasOwnProperty` keeps the lookup to real namespaces.
	if (!Object.prototype.hasOwnProperty.call(store.translations, namespaceKey as PropertyKey)) {
		return { value: MISSING, targetLocale };
	}

	const namespaceState = store.translations[namespaceKey];
	const translation = useCommittedTranslation
		? namespaceState.currentLocale === store.currentLocale
			? namespaceState.currentTranslation
			: undefined
		: namespaceState.translations[targetLocale]?.namespace;

	if (translation === undefined) {
		return { value: MISSING, targetLocale };
	}

	if (parts.length === 1) {
		return { value: translation, targetLocale };
	}

	let value: any = translation;
	for (let i = 1; i < parts.length; i++) {
		if (value === null || value === undefined || typeof value !== 'object') {
			return { value: MISSING, targetLocale };
		}
		const part = parts[i];
		if (part === undefined) {
			return { value: MISSING, targetLocale };
		}
		// Never walk into the prototype machinery: a user-controlled key like
		// `common.__proto__.constructor` must not resolve.
		if (part === '__proto__' || part === 'constructor' || part === 'prototype') {
			return { value: MISSING, targetLocale };
		}
		// Class-based translations declare methods on the class prototype, so
		// an own-property-only walk would miss them. Allow inherited members,
		// but never ones supplied by Object.prototype itself (`toString`,
		// `valueOf`, `hasOwnProperty`, …) — those would leak builtins to
		// callers that pass user-controlled keys into `t()`.
		if (!Object.prototype.hasOwnProperty.call(value, part)) {
			const inherited = part in value && !Object.prototype.hasOwnProperty.call(Object.prototype, part);
			if (!inherited) {
				return { value: MISSING, targetLocale };
			}
		}
		value = value[part];
		if (value === undefined) {
			return { value: MISSING, targetLocale };
		}
	}

	return { value, targetLocale };
}

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
 * @param locale - Optional locale (exact key or BCP 47 tag). Omit it to read
 * only the translation safely committed for store.currentLocale; pass it to
 * read that locale's raw cache slot
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

	const { value, targetLocale } = lookupTranslation(store, key, locale);

	if (value === MISSING) {
		// Reports the miss (if a handler is configured) and returns the key —
		// the documented "not found" contract.
		store.onMissingKey?.(key, String(targetLocale));
		return key as GetTranslationValue<M, Key>;
	}

	return value as GetTranslationValue<M, Key>;
}

/**
 * Strict variant of `getTranslation`: returns the translation value with a
 * clean type (no `| Key` union) and THROWS `TranslationMissingError` when the
 * key cannot be resolved, instead of returning the key string.
 *
 * Use it when the translation is expected to be loaded (e.g. after awaiting
 * `load()`), so object values can be used directly without narrowing:
 *
 * @template N - Type of namespaces object
 * @template L - Type of locales object
 * @template M - Type of translation modules mapping
 * @template Key - Translation key type (inferred from key parameter)
 *
 * @param store - Translation store instance
 * @param key - Translation key: "namespace", "namespace.key" or "namespace.nested.key" (fully typed)
 * @param locale - Optional locale (exact key or BCP 47 tag). Omit it to read
 * only the translation safely committed for store.currentLocale; pass it to
 * read that locale's raw cache slot
 * @returns Translation value with the exact inferred type
 * @throws {TranslationMissingError} If the key cannot be resolved (also invokes `onMissingKey` first)
 *
 * @example
 * ```ts
 * await store.translations.common.load('en');
 *
 * const message = getTranslationOrThrow(store, 'common.message');
 * message.title; // ✅ object type without `typeof` narrowing
 *
 * try {
 *   getTranslationOrThrow(store, 'common.missing' as never);
 * } catch (error) {
 *   if (error instanceof TranslationMissingError) {
 *     console.error(error.key, error.locale);
 *   }
 * }
 * ```
 */
export function getTranslationOrThrow<
	N extends Record<string, string>,
	L extends Record<string, string>,
	M extends { [K in keyof N]: any },
	Key extends TranslationKeys<M>,
>(store: TranslationStore<N, L, M>, key: Key, locale?: string | keyof L): GetTranslationValue<M, Key> {
	if (!key || typeof key !== 'string') {
		throw new TranslationMissingError(String(key), String(store.currentLocale));
	}

	const { value, targetLocale } = lookupTranslation(store, key, locale);

	if (value === MISSING) {
		// Keep monitoring consistent with getTranslation: the handler fires
		// for every miss, regardless of how the miss is surfaced.
		store.onMissingKey?.(key, String(targetLocale));
		throw new TranslationMissingError(key, String(targetLocale));
	}

	return value as GetTranslationValue<M, Key>;
}
