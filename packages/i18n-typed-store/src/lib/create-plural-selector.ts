import type { PluralVariants, PluralCategory } from '../types/plural-variants.js';
import type { CreatePluralSelectorOptions } from '../types/create-plural-selector.js';

/**
 * Creates a plural selector function for a specific locale.
 * The returned function selects the appropriate plural form based on the count
 * using Unicode CLDR plural rules.
 *
 * @param locale - Locale string (e.g., 'en', 'ru', 'fr', 'uk-UA')
 * @param options - Configuration options
 * @returns Function that takes a count and plural variants, returns the matching variant
 * @throws {TypeError} If locale is not a valid string
 * @throws {Error} If strict mode is enabled and 'other' variant is missing
 *
 * @example
 * ```ts
 * const selectPlural = createPluralSelector('en');
 * selectPlural(1, { one: 'item', other: 'items' }); // => 'item'
 * selectPlural(5, { one: 'item', other: 'items' }); // => 'items'
 * ```
 *
 * @example
 * ```ts
 * const selectPlural = createPluralSelector('ru');
 * selectPlural(1, { one: 'элемент', few: 'элемента', many: 'элементов', other: 'элементов' }); // => 'элемент'
 * selectPlural(2, { one: 'элемент', few: 'элемента', many: 'элементов', other: 'элементов' }); // => 'элемента'
 * selectPlural(5, { one: 'элемент', few: 'элемента', many: 'элементов', other: 'элементов' }); // => 'элементов'
 * ```
 */
export const createPluralSelector = (
	locale: string,
	options: CreatePluralSelectorOptions = {},
): ((count: number, variants: PluralVariants) => string) => {
	if (typeof locale !== 'string' || locale.trim().length === 0) {
		throw new TypeError(`Invalid locale: expected non-empty string, got ${typeof locale}`);
	}

	const { strict = false, intlOptions } = options;

	let pluralRules: Intl.PluralRules;
	try {
		pluralRules = new Intl.PluralRules(locale, intlOptions);
	} catch (error) {
		throw new TypeError(`Invalid locale format: ${locale}. ${error instanceof Error ? error.message : String(error)}`);
	}

	/**
	 * Selects the appropriate plural form variant based on the count.
	 *
	 * @param count - Number to determine plural form for (must be finite)
	 * @param variants - Object containing plural form variants (must include 'other')
	 * @returns The selected variant string, or 'other' variant as fallback
	 * @throws {TypeError} If count is not a finite number
	 * @throws {Error} If strict mode is enabled and 'other' variant is missing
	 */
	return (count: number, variants: PluralVariants): string => {
		if (!Number.isFinite(count)) {
			throw new TypeError(`Invalid count: expected finite number, got ${count}`);
		}

		// Check for presence, not truthiness: an empty-string `other` ('') is a
		// legitimate variant (e.g. a language that renders nothing for the
		// generic case) and must not trip strict mode.
		if (strict && variants.other === undefined) {
			throw new Error("Plural variants must include 'other' variant when strict mode is enabled");
		}

		const pluralCategory = pluralRules.select(count) as PluralCategory;
		const selectedVariant = variants[pluralCategory];

		// Return the selected variant if available, otherwise fallback to 'other'
		// 'other' is required in PluralVariants type, but we check at runtime for safety
		if (selectedVariant !== undefined && selectedVariant !== null) {
			return selectedVariant;
		}

		// Fallback to 'other' if the specific category is not provided
		// This is the standard CLDR behavior
		if (variants.other !== undefined) {
			return variants.other;
		}

		// Last resort: return empty string (should not happen if types are correct)
		return '';
	};
};
