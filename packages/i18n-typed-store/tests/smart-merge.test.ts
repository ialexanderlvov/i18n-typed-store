import { describe, it, expect } from 'vitest';
import { smartDeepMerge } from '../src/lib/smart-merge';

describe('smartDeepMerge', () => {
	it('should return fallback if current is null', () => {
		const fallback = { a: 1 };
		const result = smartDeepMerge(null, fallback);

		expect(result).toBe(fallback);
	});

	it('should return current if fallback is null', () => {
		const current = { a: 1 };
		const result = smartDeepMerge(current, null);

		expect(result).toBe(current);
	});

	it('should return fallback if current is undefined', () => {
		const fallback = { a: 1 };
		const result = smartDeepMerge(undefined, fallback);

		expect(result).toBe(fallback);
	});

	it('should return current if fallback is undefined', () => {
		const current = { a: 1 };
		const result = smartDeepMerge(current, undefined);

		expect(result).toBe(current);
	});

	it('should use fallback if structures differ (object vs primitive)', () => {
		const current = { a: 1 };
		const fallback = 'string';
		const result = smartDeepMerge(current, fallback);

		expect(result).toBe(fallback);
	});

	it('should use fallback if structures differ (primitive vs object)', () => {
		const current = 'string';
		const fallback = { a: 1 };
		const result = smartDeepMerge(current, fallback);

		expect(result).toBe(fallback);
	});

	it('should use fallback when current primitive is null', () => {
		const current = null;
		const fallback = 'fallback';
		const result = smartDeepMerge(current, fallback);

		expect(result).toBe(fallback);
	});

	it('should use current when current primitive is not null', () => {
		const current = 'current';
		const fallback = 'fallback';
		const result = smartDeepMerge(current, fallback);

		expect(result).toBe(current);
	});

	it('should use fallback if structures differ (array vs object)', () => {
		const current = [1, 2, 3];
		const fallback = { a: 1 };
		const result = smartDeepMerge(current, fallback);

		expect(result).toBe(fallback);
	});

	it('should use fallback if structures differ (object vs array)', () => {
		const current = { a: 1 };
		const fallback = [1, 2, 3];
		const result = smartDeepMerge(current, fallback);

		expect(result).toBe(fallback);
	});

	it('should use current for primitives if it is not null', () => {
		const current = 'current';
		const fallback = 'fallback';
		const result = smartDeepMerge(current, fallback);

		expect(result).toBe(current);
	});

	it('should use fallback for primitives if current is null', () => {
		const current = null;
		const fallback = 'fallback';
		const result = smartDeepMerge(current, fallback);

		expect(result).toBe(fallback);
	});

	it('should use fallback for primitives if current is null (covers line 43)', () => {
		// Test the specific branch where current != null check is false
		// When both are primitives and current is null
		// This specifically tests the ternary operator on line 43: return current != null ? current : fallback;
		const current = null;
		const fallback = 'fallback';
		const result = smartDeepMerge(current, fallback);

		// When current is null and fallback is a primitive, should return fallback
		expect(result).toBe(fallback);

		// Also test with 0 (falsy but not null)
		const result2 = smartDeepMerge(0, fallback);
		expect(result2).toBe(0); // Should return current (0) not fallback

		// Test with false (falsy but not null)
		const result3 = smartDeepMerge(false, true);
		expect(result3).toBe(false); // Should return current (false) not fallback

		// Test with empty string (falsy but not null)
		const result4 = smartDeepMerge('', fallback);
		expect(result4).toBe(''); // Should return current ('') not fallback
	});

	it('should use fallback for primitives if current is undefined', () => {
		const current = undefined;
		const fallback = 'fallback';
		const result = smartDeepMerge(current, fallback);

		expect(result).toBe(fallback);
	});

	it('should perform deep merge of objects', () => {
		const current = { a: { b: 1, c: 2 }, d: 3 };
		const fallback = { a: { b: 1, c: 3 }, d: 4 };
		const result = smartDeepMerge(current, fallback);

		// Function preserves current values for primitives if structures match
		expect(result).toEqual({ a: { b: 1, c: 2 }, d: 3 });
	});

	it('should add missing keys from fallback', () => {
		const current = { a: 1 };
		const fallback = { a: 1, b: 2, c: 3 };
		const result = smartDeepMerge(current, fallback);

		expect(result).toEqual({ a: 1, b: 2, c: 3 });
	});

	it('should preserve keys from current that are not in fallback', () => {
		const current = { a: 1, b: 2, c: 3 };
		const fallback = { a: 1 };
		const result = smartDeepMerge(current, fallback);

		expect(result).toEqual({ a: 1, b: 2, c: 3 });
	});

	it('should use fallback if structures differ at nested level', () => {
		const current = { a: { b: 1 }, c: 'string' };
		const fallback = { a: { b: 1 }, c: { d: 2 } };
		const result = smartDeepMerge(current, fallback);

		expect(result).toEqual({ a: { b: 1 }, c: { d: 2 } });
	});

	it('should use fallback when nested structures differ (object vs primitive in object)', () => {
		const current = { a: { b: 1 }, c: { d: 2 } };
		const fallback = { a: { b: 1 }, c: 'string' };
		const result = smartDeepMerge(current, fallback);

		expect(result).toEqual({ a: { b: 1 }, c: 'string' });
	});

	it('should use fallback when nested structures differ (object vs array in object)', () => {
		const current = { a: { b: 1 }, c: { d: 2 } };
		const fallback = { a: { b: 1 }, c: [1, 2] };
		const result = smartDeepMerge(current, fallback);

		expect(result).toEqual({ a: { b: 1 }, c: [1, 2] });
	});

	it('should use fallback for null values in current', () => {
		const current = { a: null, b: 2 };
		const fallback = { a: 1, b: 2 };
		const result = smartDeepMerge(current, fallback);

		expect(result).toEqual({ a: 1, b: 2 });
	});

	it('should recursively merge nested objects', () => {
		const current = {
			level1: {
				level2: {
					level3: {
						current: 'value',
						shared: 'current',
					},
				},
			},
		};
		const fallback = {
			level1: {
				level2: {
					level3: {
						shared: 'fallback',
						fallback: 'value',
					},
				},
			},
		};
		const result = smartDeepMerge(current, fallback);

		// Function preserves current values for primitives if structures match
		expect(result).toEqual({
			level1: {
				level2: {
					level3: {
						current: 'value',
						shared: 'current',
						fallback: 'value',
					},
				},
			},
		});
	});

	it('should handle empty objects', () => {
		const current = {};
		const fallback = { a: 1, b: 2 };
		const result = smartDeepMerge(current, fallback);

		expect(result).toEqual({ a: 1, b: 2 });
	});

	it('should preserve primitive references', () => {
		const current = { a: 'current', b: 42 };
		const fallback = { a: 'fallback', b: 100 };
		const result = smartDeepMerge(current, fallback);

		expect(result.a).toBe('current');
		expect(result.b).toBe(42);
	});

	it('should correctly handle complex real-world translation scenarios', () => {
		const current = {
			common: {
				greeting: 'Привет',
				buttons: {
					save: 'Сохранить',
				},
			},
			errors: {
				notFound: 'Не найдено',
			},
		};
		const fallback = {
			common: {
				greeting: 'Hello',
				buttons: {
					save: 'Save',
					cancel: 'Cancel',
				},
			},
			errors: {
				notFound: 'Not Found',
				unauthorized: 'Unauthorized',
			},
		};
		const result = smartDeepMerge(current, fallback);

		expect(result).toEqual({
			common: {
				greeting: 'Привет',
				buttons: {
					save: 'Сохранить',
					cancel: 'Cancel',
				},
			},
			errors: {
				notFound: 'Не найдено',
				unauthorized: 'Unauthorized',
			},
		});
	});

	it('should treat arrays as primitives', () => {
		const current = { items: [1, 2] };
		const fallback = { items: [3, 4] };
		const result = smartDeepMerge(current, fallback);

		expect(result.items).toEqual([1, 2]);
	});

	it('should handle boolean values', () => {
		const current = { flag: true };
		const fallback = { flag: false };
		const result = smartDeepMerge(current, fallback);

		expect(result.flag).toBe(true);
	});

	it('should handle numbers', () => {
		const current = { count: 5 };
		const fallback = { count: 10 };
		const result = smartDeepMerge(current, fallback);

		expect(result.count).toBe(5);
	});
});
