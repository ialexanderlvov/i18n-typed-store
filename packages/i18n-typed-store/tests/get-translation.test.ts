import { describe, it, expect, vi } from 'vitest';
import { createTranslationStore, getTranslation } from '../src';

describe('getTranslation', () => {
	const namespaces = { common: 'common', errors: 'errors' } as const;
	const locales = { en: 'en', ru: 'ru' } as const;

	describe('basic functionality', () => {
		it('should return translation value for simple key', async () => {
			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule: async () => ({ greeting: 'Hello' }),
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: { greeting: string } }>();

			await store.translations.common.load('en');

			const result = getTranslation(store, 'common.greeting');
			expect(result).toBe('Hello');
		});

		it('should return translation value for nested key', async () => {
			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule: async () => ({
					buttons: {
						save: 'Save',
						cancel: 'Cancel',
					},
				}),
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{
				common: { buttons: { save: string; cancel: string } };
			}>();

			await store.translations.common.load('en');

			expect(getTranslation(store, 'common.buttons.save')).toBe('Save');
			expect(getTranslation(store, 'common.buttons.cancel')).toBe('Cancel');
		});

		it('should return translation value for deeply nested key', async () => {
			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule: async () => ({
					forms: {
						user: {
							name: {
								label: 'Name',
							},
						},
					},
				}),
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{
				common: { forms: { user: { name: { label: string } } } };
			}>();

			await store.translations.common.load('en');

			const result = getTranslation(store, 'common.forms.user.name.label');
			expect(result).toBe('Name');
		});
	});

	describe('missing translations', () => {
		it('should return key if namespace does not exist', async () => {
			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule: async () => ({ greeting: 'Hello' }),
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: { greeting: string } }>();

			await store.translations.common.load('en');

			const result = getTranslation(store, 'nonexistent.key');
			expect(result).toBe('nonexistent.key');
		});

		it('should return key if translation is not loaded', () => {
			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule: async () => ({ greeting: 'Hello' }),
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: { greeting: string } }>();

			// Don't load translation
			const result = getTranslation(store, 'common.greeting');
			expect(result).toBe('common.greeting');
		});

		it('should return key if key path does not exist', async () => {
			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule: async () => ({ greeting: 'Hello' }),
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: { greeting: string } }>();

			await store.translations.common.load('en');

			const result = getTranslation(store, 'common.missing.key');
			expect(result).toBe('common.missing.key');
		});

		it('should return key if nested key does not exist', async () => {
			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule: async () => ({
					buttons: {
						save: 'Save',
					},
				}),
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{
				common: { buttons: { save: string } };
			}>();

			await store.translations.common.load('en');

			const result = getTranslation(store, 'common.buttons.missing');
			expect(result).toBe('common.buttons.missing');
		});

		it('should return non-string values', async () => {
			const handler = () => console.log('test');
			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule: async () => ({
					count: 42,
					enabled: true,
					handler,
					data: { nested: 'value' },
				}),
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{
				common: { count: number; enabled: boolean; handler: () => void; data: { nested: string } };
			}>();

			await store.translations.common.load('en');

			expect(getTranslation(store, 'common.count')).toBe(42);
			expect(getTranslation(store, 'common.enabled')).toBe(true);
			expect(getTranslation(store, 'common.handler')).toBe(handler);
			expect(getTranslation(store, 'common.data.nested')).toBe('value');
		});
	});

	describe('locale handling', () => {
		it('should use current locale by default', async () => {
			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule: async (locale) => {
					if (locale === 'en') return { greeting: 'Hello' };
					if (locale === 'ru') return { greeting: 'Привет' };
					return {};
				},
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: { greeting: string } }>();

			await store.translations.common.load('en');
			expect(getTranslation(store, 'common.greeting')).toBe('Hello');

			store.changeLocale('ru');
			await store.translations.common.load('ru');
			expect(getTranslation(store, 'common.greeting')).toBe('Привет');
		});

		it('should use specified locale when provided', async () => {
			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule: async (locale) => {
					if (locale === 'en') return { greeting: 'Hello' };
					if (locale === 'ru') return { greeting: 'Привет' };
					return {};
				},
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: { greeting: string } }>();

			await store.translations.common.load('en');
			await store.translations.common.load('ru');

			store.changeLocale('en');
			expect(getTranslation(store, 'common.greeting', 'ru')).toBe('Привет');
			expect(getTranslation(store, 'common.greeting', 'en')).toBe('Hello');
		});
	});

	describe('edge cases', () => {
		it('should return key if key is empty string', async () => {
			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule: async () => ({ greeting: 'Hello' }),
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: { greeting: string } }>();

			await store.translations.common.load('en');

			expect(getTranslation(store, '')).toBe('');
		});

		it('should return intermediate object paths', async () => {
			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule: async () => ({
					buttons: {
						save: 'Save',
						cancel: 'Cancel',
					},
					forms: {
						user: {
							name: {
								label: 'Name',
							},
						},
					},
				}),
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{
				common: {
					buttons: { save: string; cancel: string };
					forms: { user: { name: { label: string } } };
				};
			}>();

			await store.translations.common.load('en');

			// Get intermediate object path
			const buttons = getTranslation(store, 'common.buttons');
			expect(buttons).toEqual({ save: 'Save', cancel: 'Cancel' });

			const forms = getTranslation(store, 'common.forms');
			expect(forms).toEqual({ user: { name: { label: 'Name' } } });

			const user = getTranslation(store, 'common.forms.user');
			expect(user).toEqual({ name: { label: 'Name' } });

			const name = getTranslation(store, 'common.forms.user.name');
			expect(name).toEqual({ label: 'Name' });

			// Get leaf node
			const label = getTranslation(store, 'common.forms.user.name.label');
			expect(label).toBe('Name');
		});

		it('should return entire namespace object when key has no dots', async () => {
			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule: async () => ({ greeting: 'Hello', count: 42 }),
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: { greeting: string; count: number } }>();

			await store.translations.common.load('en');

			const namespace = getTranslation(store, 'common');
			expect(namespace).toEqual({ greeting: 'Hello', count: 42 });
		});

		it('should return key as string if namespace does not exist', async () => {
			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule: async () => ({ greeting: 'Hello' }),
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: { greeting: string } }>();

			await store.translations.common.load('en');

			expect(getTranslation(store, 'nonexistent' as any)).toBe('nonexistent');
		});

		it('should handle multiple namespaces', async () => {
			const storeFactory = createTranslationStore({
				namespaces,
				locales,
				loadModule: async (locale, namespace) => {
					if (namespace === 'common') return { greeting: 'Hello' };
					if (namespace === 'errors') return { notFound: 'Not Found' };
					return {};
				},
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{
				common: { greeting: string };
				errors: { notFound: string };
			}>();

			await store.translations.common.load('en');
			await store.translations.errors.load('en');

			expect(getTranslation(store, 'common.greeting')).toBe('Hello');
			expect(getTranslation(store, 'errors.notFound')).toBe('Not Found');
		});

		it('should handle empty strings in path', async () => {
			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule: async () => ({
					empty: '',
					value: 'Valid',
				}),
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{
				common: { empty: string; value: string };
			}>();

			await store.translations.common.load('en');

			expect(getTranslation(store, 'common.empty')).toBe('');
			expect(getTranslation(store, 'common.value')).toBe('Valid');
		});

		it('should handle arrays in translation values', async () => {
			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule: async () => ({
					items: ['item1', 'item2', 'item3'],
					single: 'single',
				}),
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{
				common: { items: string[]; single: string };
			}>();

			await store.translations.common.load('en');

			// Arrays should be returned as-is (any type is supported)
			const items = getTranslation(store, 'common.items');
			expect(Array.isArray(items)).toBe(true);
			expect(items).toEqual(['item1', 'item2', 'item3']);
			expect(getTranslation(store, 'common.single')).toBe('single');
		});

		it('should handle null and undefined values in path', async () => {
			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule: async () => ({
					value: null,
					undefinedValue: undefined,
					valid: 'Valid',
				}),
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{
				common: { value: null; undefinedValue: undefined; valid: string };
			}>();

			await store.translations.common.load('en');

			expect(getTranslation(store, 'common.value.nested')).toBe('common.value.nested');
			expect(getTranslation(store, 'common.undefinedValue.nested')).toBe('common.undefinedValue.nested');
			expect(getTranslation(store, 'common.valid')).toBe('Valid');
		});

		it('should return key if part is undefined (covers line 94)', async () => {
			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule: async () => ({
					buttons: {
						save: 'Save',
					},
				}),
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{
				common: { buttons: { save: string } };
			}>();

			await store.translations.common.load('en');

			// To trigger part === undefined, we need to simulate a sparse array
			// Since split('.') always returns a dense array, we need to mock String.prototype.split
			// to return an array with undefined at some index
			const originalSplit = String.prototype.split;
			const mockSplit = vi.fn().mockImplementation(function (separator?: string | RegExp, limit?: number) {
				const result = originalSplit.call(this, separator, limit);
				// Create a sparse array by deleting an element at index 1
				// This simulates the edge case where parts[i] could be undefined
				if (result.length > 1 && typeof separator === 'string' && separator === '.') {
					// Create a new array with undefined at index 1
					const sparseArray: string[] = [];
					sparseArray[0] = result[0];
					// Leave index 1 as undefined
					if (result.length > 2) {
						for (let i = 2; i < result.length; i++) {
							sparseArray[i] = result[i];
						}
					}
					// Set length to maintain array structure
					sparseArray.length = result.length;
					return sparseArray;
				}
				return result;
			});

			try {
				// Mock split only for this specific call
				const testKey = 'common.buttons.save';
				Object.defineProperty(String.prototype, 'split', {
					value: mockSplit,
					writable: true,
					configurable: true,
				});

				// Now when we call getTranslation, split will return array with undefined at index 1
				const result = getTranslation(store, testKey as any);
				// Should return the key because part at index 1 is undefined
				expect(result).toBe(testKey);
				expect(mockSplit).toHaveBeenCalled();
			} finally {
				// Restore original split
				Object.defineProperty(String.prototype, 'split', {
					value: originalSplit,
					writable: true,
					configurable: true,
				});
			}
		});
	});
});
