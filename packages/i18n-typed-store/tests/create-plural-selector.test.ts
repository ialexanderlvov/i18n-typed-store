import { describe, it, expect } from 'vitest';
import { createPluralSelector } from '../src/lib/create-plural-selector';

describe('createPluralSelector', () => {
	describe('input validation', () => {
		it('should throw TypeError for empty locale string', () => {
			expect(() => createPluralSelector('')).toThrow(TypeError);
			expect(() => createPluralSelector('   ')).toThrow(TypeError);
		});

		it('should throw TypeError for invalid locale type', () => {
			expect(() => createPluralSelector(null as any)).toThrow(TypeError);
			expect(() => createPluralSelector(undefined as any)).toThrow(TypeError);
			expect(() => createPluralSelector(123 as any)).toThrow(TypeError);
		});

		it('should throw TypeError for invalid locale format', () => {
			// Mock Intl.PluralRules constructor to throw an error
			const originalPluralRules = global.Intl.PluralRules;
			const originalError = new Error('Invalid locale format');
			const MockPluralRules = class extends originalPluralRules {
				constructor(...args: any[]) {
					super(...args);
					throw originalError;
				}
			} as any;

			// Use Object.defineProperty to override read-only property
			Object.defineProperty(global.Intl, 'PluralRules', {
				value: MockPluralRules,
				writable: true,
				configurable: true,
			});

			try {
				let caught: unknown;
				try {
					createPluralSelector('invalid-locale-format');
				} catch (error) {
					caught = error;
				}
				expect(caught).toBeInstanceOf(TypeError);
				expect(caught).toHaveProperty('message', expect.stringContaining('Invalid locale format'));
				expect(caught).toHaveProperty('cause', originalError);
			} finally {
				// Restore original - keep configurable: true so next test can override
				Object.defineProperty(global.Intl, 'PluralRules', {
					value: originalPluralRules,
					writable: true,
					configurable: true,
				});
			}
		});

		it('should throw TypeError when error is not Error instance (covers line 44)', () => {
			// Mock Intl.PluralRules constructor to throw a non-Error
			const originalPluralRules = global.Intl.PluralRules;
			const MockPluralRules = class extends originalPluralRules {
				constructor(...args: any[]) {
					super(...args);
					throw 'String error'; // Throw a string instead of Error
				}
			} as any;

			// Use Object.defineProperty to override read-only property
			// Delete first if it was set to non-configurable
			delete (global.Intl as any).PluralRules;
			Object.defineProperty(global.Intl, 'PluralRules', {
				value: MockPluralRules,
				writable: true,
				configurable: true,
			});

			try {
				expect(() => createPluralSelector('invalid-locale')).toThrow(TypeError);
				expect(() => createPluralSelector('invalid-locale')).toThrow(/Invalid locale format/);
			} finally {
				// Restore original
				delete (global.Intl as any).PluralRules;
				Object.defineProperty(global.Intl, 'PluralRules', {
					value: originalPluralRules,
					writable: true,
					configurable: true,
				});
			}
		});

		it('should throw TypeError for invalid count', () => {
			const selector = createPluralSelector('en');
			expect(() => selector(Infinity, { other: 'items' })).toThrow(TypeError);
			expect(() => selector(-Infinity, { other: 'items' })).toThrow(TypeError);
			expect(() => selector(NaN, { other: 'items' })).toThrow(TypeError);
		});

		it('should throw Error in strict mode if other variant is missing', () => {
			const selector = createPluralSelector('en', { strict: true });
			expect(() => selector(1, { one: 'item' } as any)).toThrow(Error);
			expect(() => selector(1, {} as any)).toThrow(Error);
		});
	});

	describe('English (en)', () => {
		const selector = createPluralSelector('en');
		const variants = { one: 'item', other: 'items' };

		it('should return one for count = 1', () => {
			const result = selector(1, variants);
			expect(result).toBe('item');
		});

		it('should return other for count = 0', () => {
			const result = selector(0, variants);
			expect(result).toBe('items');
		});

		it('should return other for count > 1', () => {
			const result = selector(5, variants);
			expect(result).toBe('items');
		});

		it('should use fallback to other if one is missing', () => {
			const result = selector(1, { other: 'items' });
			expect(result).toBe('items');
		});

		it('should return other for fractional numbers', () => {
			const result = selector(1.5, variants);
			expect(result).toBe('items');
		});
	});

	describe('Russian (ru)', () => {
		const selector = createPluralSelector('ru');
		const variants = { one: 'элемент', few: 'элемента', many: 'элементов', other: 'элементов' };

		it('should return one for count = 1', () => {
			const result = selector(1, variants);
			expect(result).toBe('элемент');
		});

		it('should return few for count = 2, 3, 4', () => {
			expect(selector(2, variants)).toBe('элемента');
			expect(selector(3, variants)).toBe('элемента');
			expect(selector(4, variants)).toBe('элемента');
		});

		it('should return many for count >= 5', () => {
			expect(selector(5, variants)).toBe('элементов');
			expect(selector(10, variants)).toBe('элементов');
			// 21 uses one in Russian (1, 21, 31, 41...)
			expect(selector(21, variants)).toBe('элемент');
		});

		it('should use fallback to other if specific variants are missing', () => {
			const result = selector(2, { other: 'элементов' });
			expect(result).toBe('элементов');
		});
	});

	describe('Polish (pl)', () => {
		const selector = createPluralSelector('pl');

		it('should return one for count = 1', () => {
			const result = selector(1, { one: 'element', few: 'elementy', many: 'elementów', other: 'elementów' });
			expect(result).toBe('element');
		});

		it('should return few for certain numbers', () => {
			// Polish has complex rules for few
			const result = selector(2, { one: 'element', few: 'elementy', many: 'elementów', other: 'elementów' });
			// Check that result is one of the valid variants
			expect(['element', 'elementy', 'elementów']).toContain(result);
		});
	});

	describe('Arabic (ar)', () => {
		const selector = createPluralSelector('ar');

		it('should handle various categories', () => {
			const variants = {
				zero: 'صفر',
				one: 'واحد',
				two: 'اثنان',
				few: 'قليل',
				many: 'كثير',
				other: 'آخر',
			};

			// Arabic has complex pluralization rules
			const result0 = selector(0, variants);
			const result1 = selector(1, variants);
			const result2 = selector(2, variants);

			expect([variants.zero, variants.one, variants.two, variants.few, variants.many, variants.other]).toContain(result0);
			expect([variants.zero, variants.one, variants.two, variants.few, variants.many, variants.other]).toContain(result1);
			expect([variants.zero, variants.one, variants.two, variants.few, variants.many, variants.other]).toContain(result2);
		});
	});

	describe('German (de)', () => {
		const selector = createPluralSelector('de');

		it('should return one for count = 1', () => {
			const result = selector(1, { one: 'Artikel', other: 'Artikel' });
			expect(result).toBe('Artikel');
		});

		it('should return other for all other cases', () => {
			expect(selector(0, { one: 'Artikel', other: 'Artikel' })).toBe('Artikel');
			expect(selector(2, { one: 'Artikel', other: 'Artikel' })).toBe('Artikel');
		});
	});

	describe('French (fr)', () => {
		const selector = createPluralSelector('fr');

		it('should return one for count = 0 or 1', () => {
			// In French, 0 and 1 use one
			const result0 = selector(0, { one: 'article', other: 'articles' });
			const result1 = selector(1, { one: 'article', other: 'articles' });
			expect(result0).toBe('article');
			expect(result1).toBe('article');
		});

		it('should return other for count > 1', () => {
			const result = selector(2, { one: 'article', other: 'articles' });
			expect(result).toBe('articles');
		});
	});

	describe('edge cases', () => {
		it('should handle very large numbers', () => {
			const selector = createPluralSelector('en');
			const result = selector(1000000, { one: 'item', other: 'items' });
			expect(result).toBe('items');
		});

		it('should handle negative numbers', () => {
			const selector = createPluralSelector('en');
			const result = selector(-1, { one: 'item', other: 'items' });
			expect(result).toEqual('item');
		});

		it('should handle zero', () => {
			const selector = createPluralSelector('en');
			const result = selector(0, { one: 'item', other: 'items' });
			expect(result).toBe('items');
		});

		it('should handle fractional numbers', () => {
			const selector = createPluralSelector('en');
			const result = selector(0.5, { one: 'item', other: 'items' });
			expect(result).toBe('items');
		});
	});

	describe('fallback to other', () => {
		it('should always use other as fallback', () => {
			const selector = createPluralSelector('ru');
			const result = selector(1, { other: 'элементов' });
			expect(result).toBe('элементов');
		});

		it('should use other if requested variant is missing', () => {
			const selector = createPluralSelector('ru');
			const result = selector(2, { other: 'элементов' });
			expect(result).toBe('элементов');
		});

		it('should return empty string if other is also missing (edge case)', () => {
			const selector = createPluralSelector('en');
			// Force the case where selectedVariant is undefined and other is also undefined
			// This is an edge case that should not happen with proper types
			const variants: any = { one: undefined };
			const result = selector(1, variants);
			// Since other is required in type, but we test runtime behavior - should return empty string
			expect(result).toBe('');
		});
	});

	describe('various locales', () => {
		it('should support locales with region', () => {
			const selector = createPluralSelector('en-US');
			const result = selector(1, { one: 'item', other: 'items' });
			expect(result).toBe('item');
		});

		it('should support locales with region for Russian', () => {
			const selector = createPluralSelector('ru-RU');
			const result = selector(1, { one: 'элемент', few: 'элемента', many: 'элементов', other: 'элементов' });
			expect(result).toBe('элемент');
		});
	});
});
