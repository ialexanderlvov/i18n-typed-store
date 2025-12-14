import { describe, it, expect } from 'vitest';
import { createPluralSelector } from '../src/utils/create-plural-selector';
import { PluralVariants } from '../src/types/plural-variants';

describe('createPluralSelector', () => {
	describe('English (en)', () => {
		it('should return "one" for count 1', () => {
			const selectPlural = createPluralSelector('en');
			const variants: PluralVariants = {
				one: 'item',
				other: 'items',
			};

			expect(selectPlural(1, variants)).toBe('item');
		});

		it('should return "other" for count 0', () => {
			const selectPlural = createPluralSelector('en');
			const variants: PluralVariants = {
				one: 'item',
				other: 'items',
			};

			expect(selectPlural(0, variants)).toBe('items');
		});

		it('should return "other" for count greater than 1', () => {
			const selectPlural = createPluralSelector('en');
			const variants: PluralVariants = {
				one: 'item',
				other: 'items',
			};

			expect(selectPlural(2, variants)).toBe('items');
			expect(selectPlural(5, variants)).toBe('items');
			expect(selectPlural(100, variants)).toBe('items');
		});

		it('should fallback to "other" if specific category is missing', () => {
			const selectPlural = createPluralSelector('en');
			const variants: PluralVariants = {
				other: 'items',
			};

			expect(selectPlural(1, variants)).toBe('items');
		});

		it('should return empty string if no variants provided', () => {
			const selectPlural = createPluralSelector('en');
			const variants: PluralVariants = {};

			expect(selectPlural(1, variants)).toBe('');
		});
	});

	describe('Russian (ru)', () => {
		it('should return "one" for count ending in 1 (except 11)', () => {
			const selectPlural = createPluralSelector('ru');
			const variants: PluralVariants = {
				one: 'яблоко',
				few: 'яблока',
				many: 'яблок',
				other: 'яблок',
			};

			expect(selectPlural(1, variants)).toBe('яблоко');
			expect(selectPlural(21, variants)).toBe('яблоко');
			expect(selectPlural(101, variants)).toBe('яблоко');
		});

		it('should return "few" for counts 2-4, 22-24, etc.', () => {
			const selectPlural = createPluralSelector('ru');
			const variants: PluralVariants = {
				one: 'яблоко',
				few: 'яблока',
				many: 'яблок',
				other: 'яблок',
			};

			expect(selectPlural(2, variants)).toBe('яблока');
			expect(selectPlural(3, variants)).toBe('яблока');
			expect(selectPlural(4, variants)).toBe('яблока');
			expect(selectPlural(22, variants)).toBe('яблока');
			expect(selectPlural(23, variants)).toBe('яблока');
		});

		it('should return "many" for counts 5-20, 25-30, etc.', () => {
			const selectPlural = createPluralSelector('ru');
			const variants: PluralVariants = {
				one: 'яблоко',
				few: 'яблока',
				many: 'яблок',
				other: 'яблок',
			};

			expect(selectPlural(5, variants)).toBe('яблок');
			expect(selectPlural(10, variants)).toBe('яблок');
			expect(selectPlural(11, variants)).toBe('яблок');
			expect(selectPlural(20, variants)).toBe('яблок');
			expect(selectPlural(25, variants)).toBe('яблок');
		});

		it('should return "other" for 0', () => {
			const selectPlural = createPluralSelector('ru');
			const variants: PluralVariants = {
				one: 'яблоко',
				few: 'яблока',
				many: 'яблок',
				other: 'яблок',
			};

			expect(selectPlural(0, variants)).toBe('яблок');
		});
	});

	describe('French (fr)', () => {
		it('should return "one" for count 0 and 1', () => {
			const selectPlural = createPluralSelector('fr');
			const variants: PluralVariants = {
				one: 'élément',
				other: 'éléments',
			};

			expect(selectPlural(0, variants)).toBe('élément');
			expect(selectPlural(1, variants)).toBe('élément');
		});

		it('should return "other" for count greater than 1', () => {
			const selectPlural = createPluralSelector('fr');
			const variants: PluralVariants = {
				one: 'élément',
				other: 'éléments',
			};

			expect(selectPlural(2, variants)).toBe('éléments');
			expect(selectPlural(10, variants)).toBe('éléments');
		});
	});

	describe('Polish (pl)', () => {
		it('should return "one" for count 1', () => {
			const selectPlural = createPluralSelector('pl');
			const variants: PluralVariants = {
				one: 'element',
				few: 'elementy',
				many: 'elementów',
				other: 'elementów',
			};

			expect(selectPlural(1, variants)).toBe('element');
		});

		it('should return "few" for counts 2-4', () => {
			const selectPlural = createPluralSelector('pl');
			const variants: PluralVariants = {
				one: 'element',
				few: 'elementy',
				many: 'elementów',
				other: 'elementów',
			};

			expect(selectPlural(2, variants)).toBe('elementy');
			expect(selectPlural(3, variants)).toBe('elementy');
			expect(selectPlural(4, variants)).toBe('elementy');
		});

		it('should return "many" for counts 5+', () => {
			const selectPlural = createPluralSelector('pl');
			const variants: PluralVariants = {
				one: 'element',
				few: 'elementy',
				many: 'elementów',
				other: 'elementów',
			};

			expect(selectPlural(5, variants)).toBe('elementów');
			expect(selectPlural(10, variants)).toBe('elementów');
			expect(selectPlural(22, variants)).toBe('elementy');
		});
	});

	describe('Arabic (ar)', () => {
		it('should handle all plural categories', () => {
			const selectPlural = createPluralSelector('ar');
			const variants: PluralVariants = {
				zero: 'صفر',
				one: 'واحد',
				two: 'اثنان',
				few: 'قليل',
				many: 'كثير',
				other: 'آخر',
			};

			expect(selectPlural(0, variants)).toBe('صفر');
			expect(selectPlural(1, variants)).toBe('واحد');
			expect(selectPlural(2, variants)).toBe('اثنان');
		});
	});

	describe('Edge cases', () => {
		it('should handle negative numbers', () => {
			const selectPlural = createPluralSelector('en');
			const variants: PluralVariants = {
				one: 'item',
				other: 'items',
			};

			expect(selectPlural(-1, variants)).toBe('item');
			expect(selectPlural(-5, variants)).toBe('items');
		});

		it('should handle decimal numbers', () => {
			const selectPlural = createPluralSelector('en');
			const variants: PluralVariants = {
				one: 'item',
				other: 'items',
			};

			expect(selectPlural(1.5, variants)).toBe('items');
			expect(selectPlural(0.5, variants)).toBe('items');
		});

		it('should handle very large numbers', () => {
			const selectPlural = createPluralSelector('en');
			const variants: PluralVariants = {
				one: 'item',
				other: 'items',
			};

			expect(selectPlural(1000000, variants)).toBe('items');
			expect(selectPlural(Number.MAX_SAFE_INTEGER, variants)).toBe('items');
		});

		it('should work with full locale strings', () => {
			const selectPlural = createPluralSelector('en-US');
			const variants: PluralVariants = {
				one: 'item',
				other: 'items',
			};

			expect(selectPlural(1, variants)).toBe('item');
			expect(selectPlural(5, variants)).toBe('items');
		});

		it('should fallback to other when category is missing', () => {
			const selectPlural = createPluralSelector('ru');
			const variants: PluralVariants = {
				other: 'яблок',
			};

			// Even if specific category is missing, should fallback to 'other'
			expect(selectPlural(1, variants)).toBe('яблок');
			expect(selectPlural(2, variants)).toBe('яблок');
		});
	});
});
