import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { interpolate } from '../src/lib/interpolate';
import { createIntlFormatters } from '../src/lib/intl-formatters';
import { createPluralSelector } from '../src/lib/create-plural-selector';
import { createTranslationStore } from '../src/lib/create-translation-store';
import { getTranslation } from '../src/lib/get-translation';
import type { InterpolationParams } from '../src/types/interpolate';

describe('interpolate', () => {
	it('substitutes named placeholders', () => {
		expect(interpolate('Hello {{name}}!', { name: 'Alex' })).toBe('Hello Alex!');
	});

	it('supports numbers and booleans, and trims placeholder whitespace', () => {
		expect(interpolate('{{count}} of {{ total }} done: {{ok}}', { count: 3, total: 10, ok: true })).toBe('3 of 10 done: true');
	});

	it('substitutes a repeated placeholder everywhere', () => {
		expect(interpolate('{{name}} and {{name}}', { name: 'x' })).toBe('x and x');
	});

	it('leaves unknown placeholders verbatim', () => {
		expect(interpolate('Hello {{name}}!', {} as never)).toBe('Hello {{name}}!');
	});

	it('leaves placeholders with null/undefined values verbatim', () => {
		expect(interpolate('Hi {{name}}', { name: undefined as never })).toBe('Hi {{name}}');
	});

	it('does not leak prototype members through placeholder names', () => {
		expect(interpolate('{{constructor}} {{toString}}' as string, {})).toBe('{{constructor}} {{toString}}');
	});

	it('takes no params for placeholder-free templates', () => {
		expect(interpolate('Plain text')).toBe('Plain text');
	});

	it('derives the params type from the template literal', () => {
		expectTypeOf<InterpolationParams<'Hello {{name}}, {{ count }} items'>>().toEqualTypeOf<{
			name: string | number | boolean;
			count: string | number | boolean;
		}>();

		// @ts-expect-error — 'name' is required by the template
		interpolate('Hello {{name}}!', {});

		// @ts-expect-error — placeholder-free template takes no params object
		interpolate('Plain text', { name: 'x' });
	});
});

describe('createIntlFormatters', () => {
	const en = createIntlFormatters('en');
	const ru = createIntlFormatters('ru');

	it('throws on an invalid locale', () => {
		expect(() => createIntlFormatters('')).toThrow(TypeError);
		expect(() => createIntlFormatters(undefined as never)).toThrow(TypeError);
	});

	it('formats numbers per locale', () => {
		expect(en.number(1234.5)).toBe('1,234.5');
		// ru uses a non-breaking space group separator and comma decimal
		expect(ru.number(1234.5).replace(/ /g, ' ')).toBe('1 234,5');
	});

	it('formats currency and percent', () => {
		expect(en.currency(9.99, 'USD')).toBe('$9.99');
		expect(en.percent(0.42)).toBe('42%');
	});

	it('formats dates and times', () => {
		const date = new Date('2026-01-15T14:30:00');
		expect(en.date(date)).toBe('Jan 15, 2026');
		expect(en.time(date)).toMatch(/2:30/);
		expect(en.dateTime(date)).toMatch(/Jan 15, 2026/);
	});

	it('accepts timestamps and ISO strings for dates', () => {
		expect(en.date('2026-01-15T00:00:00')).toBe('Jan 15, 2026');
		expect(en.date(new Date('2026-01-15T00:00:00').getTime())).toBe('Jan 15, 2026');
	});

	it('formats relative time and lists', () => {
		expect(en.relativeTime(-1, 'day')).toBe('1 day ago');
		expect(en.list(['a', 'b', 'c'])).toBe('a, b, and c');
	});

	it('reuses cached formatter instances', () => {
		const OriginalNumberFormat = Intl.NumberFormat;
		// A bare spyOn does not construct properly under `new` — delegate to
		// the real constructor while keeping call counting.
		const spy = vi.spyOn(Intl, 'NumberFormat').mockImplementation(function (...args: ConstructorParameters<typeof Intl.NumberFormat>) {
			return new OriginalNumberFormat(...args);
		} as never);
		const formatters = createIntlFormatters('en');
		formatters.number(1);
		formatters.number(2);
		formatters.number(3, { minimumFractionDigits: 2 });
		formatters.number(4, { minimumFractionDigits: 2 });
		// one instance per distinct options object
		expect(spy).toHaveBeenCalledTimes(2);
		spy.mockRestore();
	});
});

describe('createPluralSelector intlOptions', () => {
	it('supports ordinal plural rules', () => {
		const ordinal = createPluralSelector('en', { intlOptions: { type: 'ordinal' } });
		const suffixes = { one: 'st', two: 'nd', few: 'rd', other: 'th' };
		expect(ordinal(1, suffixes)).toBe('st');
		expect(ordinal(2, suffixes)).toBe('nd');
		expect(ordinal(3, suffixes)).toBe('rd');
		expect(ordinal(4, suffixes)).toBe('th');
		expect(ordinal(11, suffixes)).toBe('th');
		expect(ordinal(21, suffixes)).toBe('st');
	});

	it('supports fraction-aware cardinal selection', () => {
		const plural = createPluralSelector('en', { intlOptions: { minimumFractionDigits: 1 } });
		// With fraction digits, English "1.0 stars" is 'other', not 'one'
		expect(plural(1, { one: 'star', other: 'stars' })).toBe('stars');
	});
});

describe('onMissingKey', () => {
	const buildStore = (onMissingKey?: (key: string, locale: string) => void) => {
		const store = createTranslationStore({
			namespaces: { common: 'common' } as const,
			locales: { en: 'en', ru: 'ru' } as const,
			loadModule: async () => ({ greeting: 'Hello' }),
			extractTranslation: (module) => module,
			defaultLocale: 'en',
			onMissingKey,
		}).type<{ common: { greeting: string } }>();
		return store;
	};

	it('reports a miss when the namespace is not loaded', () => {
		const onMissingKey = vi.fn();
		const store = buildStore(onMissingKey);

		expect(getTranslation(store, 'common.greeting')).toBe('common.greeting');
		expect(onMissingKey).toHaveBeenCalledWith('common.greeting', 'en');
	});

	it('reports a miss for an unknown path but not for a hit', async () => {
		const onMissingKey = vi.fn();
		const store = buildStore(onMissingKey);
		await store.translations.common.load('en');

		expect(getTranslation(store, 'common.greeting')).toBe('Hello');
		expect(onMissingKey).not.toHaveBeenCalled();

		expect(getTranslation(store, 'common.missing' as never)).toBe('common.missing');
		expect(onMissingKey).toHaveBeenCalledWith('common.missing', 'en');
	});

	it('works without a handler configured', async () => {
		const store = buildStore();
		expect(getTranslation(store, 'common.greeting')).toBe('common.greeting');
	});
});
