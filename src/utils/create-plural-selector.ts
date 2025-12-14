import { PluralVariants } from '../types/plural-variants';

/**
 * Creates a plural selector function for a specific locale.
 * The returned function selects the appropriate plural form based on the count.
 *
 * @param locale - Locale string (e.g., 'en', 'ru', 'fr')
 * @returns Function that takes a count and plural variants, returns the matching variant
 *
 * @example
 * ```ts
 * const selectPlural = createPluralSelector('en');
 * selectPlural(1, { one: 'item', other: 'items' }); // => 'item'
 * selectPlural(5, { one: 'item', other: 'items' }); // => 'items'
 * ```
 */
export const createPluralSelector = (locale: string) => {
	const pluralRules = new Intl.PluralRules(locale);

	/**
	 * Selects the appropriate plural form variant based on the count.
	 *
	 * @param count - Number to determine plural form for
	 * @param variants - Object containing plural form variants
	 * @returns The selected variant string, or 'other' variant as fallback, or empty string if no variant found
	 */
	return (count: number, variants: PluralVariants): string => {
		const pluralCategory = pluralRules.select(count) as keyof PluralVariants;
		const selectedVariant = variants[pluralCategory];

		if (selectedVariant) {
			return selectedVariant;
		}

		// Fallback to 'other' if the specific category is not provided
		return variants.other ?? '';
	};
};
