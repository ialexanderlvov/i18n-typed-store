/**
 * Locale-aware formatting helpers built on the standard `Intl` APIs.
 * Formatter instances are cached per options object, since constructing
 * `Intl.*Format` is expensive relative to calling `format()`.
 */
export interface IntlFormatters {
	/** Formats a number: `1234.5` → `'1,234.5'` (en) / `'1 234,5'` (ru). */
	number: (value: number, options?: Intl.NumberFormatOptions) => string;
	/** Formats a currency amount: `(9.99, 'USD')` → `'$9.99'` (en). */
	currency: (value: number, currency: string, options?: Intl.NumberFormatOptions) => string;
	/** Formats a ratio as a percentage: `0.42` → `'42%'`. */
	percent: (value: number, options?: Intl.NumberFormatOptions) => string;
	/** Formats the date part: defaults to the locale's medium date style. */
	date: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string;
	/** Formats the time part: defaults to the locale's short time style. */
	time: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string;
	/** Formats date and time together: medium date + short time by default. */
	dateTime: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string;
	/** Formats a relative time: `(-1, 'day')` → `'1 day ago'` (en). */
	relativeTime: (value: number, unit: Intl.RelativeTimeFormatUnit, options?: Intl.RelativeTimeFormatOptions) => string;
	/** Formats a list: `['a', 'b', 'c']` → `'a, b, and c'` (en). */
	list: (items: string[], options?: Intl.ListFormatOptions) => string;
}

const toDate = (value: Date | number | string): Date => (value instanceof Date ? value : new Date(value));

/**
 * Creates a set of locale-bound, cached `Intl` formatters.
 *
 * Designed to be used inside translation modules, so each locale's
 * translations format numbers/dates/lists according to that locale's rules:
 *
 * @param locale - BCP 47 locale tag (e.g. 'en', 'ru', 'de-AT')
 * @returns Formatting helpers bound to the locale
 * @throws {TypeError} If locale is not a non-empty string
 *
 * @example
 * ```ts
 * // en.ts
 * const fmt = createIntlFormatters('en');
 *
 * export default {
 *   cartTotal: (total: number) => `Total: ${fmt.currency(total, 'USD')}`,
 *   lastSeen: (date: Date) => `Last seen ${fmt.relativeTime(-1, 'hour')}`,
 *   attendees: (names: string[]) => `${fmt.list(names)} joined`,
 * };
 * ```
 */
export const createIntlFormatters = (locale: string): IntlFormatters => {
	if (typeof locale !== 'string' || locale.trim().length === 0) {
		throw new TypeError(`Invalid locale: expected non-empty string, got ${typeof locale}`);
	}

	// One cache per Intl constructor; keys are the serialized options.
	const numberFormats = new Map<string, Intl.NumberFormat>();
	const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();
	const relativeTimeFormats = new Map<string, Intl.RelativeTimeFormat>();
	const listFormats = new Map<string, Intl.ListFormat>();

	const getCached = <T>(cache: Map<string, T>, options: object | undefined, create: () => T): T => {
		const key = options ? JSON.stringify(options) : '';
		let format = cache.get(key);
		if (!format) {
			format = create();
			cache.set(key, format);
		}
		return format;
	};

	const formatDate = (value: Date | number | string, options: Intl.DateTimeFormatOptions): string =>
		getCached(dateTimeFormats, options, () => new Intl.DateTimeFormat(locale, options)).format(toDate(value));

	return {
		number: (value, options) => getCached(numberFormats, options, () => new Intl.NumberFormat(locale, options)).format(value),

		currency: (value, currency, options) => {
			const merged: Intl.NumberFormatOptions = { style: 'currency', currency, ...options };
			return getCached(numberFormats, merged, () => new Intl.NumberFormat(locale, merged)).format(value);
		},

		percent: (value, options) => {
			const merged: Intl.NumberFormatOptions = { style: 'percent', ...options };
			return getCached(numberFormats, merged, () => new Intl.NumberFormat(locale, merged)).format(value);
		},

		date: (value, options) => formatDate(value, options ?? { dateStyle: 'medium' }),

		time: (value, options) => formatDate(value, options ?? { timeStyle: 'short' }),

		dateTime: (value, options) => formatDate(value, options ?? { dateStyle: 'medium', timeStyle: 'short' }),

		relativeTime: (value, unit, options) =>
			getCached(relativeTimeFormats, options, () => new Intl.RelativeTimeFormat(locale, options)).format(value, unit),

		list: (items, options) => getCached(listFormats, options, () => new Intl.ListFormat(locale, options)).format(items),
	};
};
