/**
 * Plural form variants for different plural categories.
 * Based on Unicode CLDR plural rules: zero, one, two, few, many, other.
 *
 * @see https://unicode-org.github.io/cldr-staging/charts/latest/supplemental/language_plural_rules.html
 *
 * @example
 * ```ts
 * const variants: PluralVariants = {
 *   one: 'item',
 *   other: 'items'
 * };
 * ```
 */
export type PluralVariants = {
	/** Used for count = 0 (in some languages) */
	zero?: string;
	/** Used for count = 1 (in most languages) */
	one?: string;
	/** Used for count = 2 (in some languages like Welsh) */
	two?: string;
	/** Used for small numbers (e.g., 3-10 in Russian) */
	few?: string;
	/** Used for large numbers or fractional values */
	many?: string;
	/** Default/fallback variant - MUST be provided for correct pluralization */
	other: string;
};

/**
 * Valid plural category names according to CLDR.
 */
export type PluralCategory = keyof PluralVariants;
