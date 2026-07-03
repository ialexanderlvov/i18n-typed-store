/**
 * Options for creating a plural selector.
 */
export interface CreatePluralSelectorOptions {
	/**
	 * Whether to throw an error if 'other' variant is missing.
	 * @default false
	 */
	strict?: boolean;
	/**
	 * Options passed through to `Intl.PluralRules`.
	 * Use `{ type: 'ordinal' }` for ordinals (1st/2nd/3rd), or
	 * `{ minimumFractionDigits: 1 }` for fraction-aware selection
	 * (English "1.0 stars" is `other`, not `one`).
	 *
	 * @example
	 * ```ts
	 * const ordinal = createPluralSelector('en', { intlOptions: { type: 'ordinal' } });
	 * ordinal(1, { one: 'st', two: 'nd', few: 'rd', other: 'th' }); // => 'st'
	 * ordinal(3, { one: 'st', two: 'nd', few: 'rd', other: 'th' }); // => 'rd'
	 * ```
	 */
	intlOptions?: Intl.PluralRulesOptions;
}
