/**
 * Plural form variants for different plural categories.
 * Based on Unicode CLDR plural rules: zero, one, two, few, many, other.
 */
export type PluralVariants = {
	zero?: string;
	one?: string;
	two?: string;
	few?: string;
	many?: string;
	other?: string;
};
