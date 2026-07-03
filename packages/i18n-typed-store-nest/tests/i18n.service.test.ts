import { createTranslationStore } from 'i18n-typed-store';
import { describe, it, expect } from 'vitest';
import { I18nModuleOptions, I18nService } from '../src';

describe('I18nService', () => {
	const namespaces = { common: 'common', errors: 'errors' } as const;
	const locales = { en: 'en', ru: 'ru' } as const;

	type TestTranslations = {
		common: {
			greeting: string;
			count: number;
			buttons: {
				save: string;
				cancel: string;
			};
		};
		errors: {
			notFound: string;
		};
	};

	const createTestService = () => {
		const storeFactory = createTranslationStore({
			namespaces,
			locales,
			loadModule: async (locale, namespace) => {
				if (locale === 'en') {
					if (namespace === 'common') {
						return {
							greeting: 'Hello',
							count: 42,
							buttons: {
								save: 'Save',
								cancel: 'Cancel',
							},
						};
					}
					if (namespace === 'errors') {
						return { notFound: 'Not Found' };
					}
				}
				if (locale === 'ru') {
					if (namespace === 'common') {
						return {
							greeting: 'Привет',
							count: 42,
							buttons: {
								save: 'Сохранить',
								cancel: 'Отмена',
							},
						};
					}
					if (namespace === 'errors') {
						return { notFound: 'Не найдено' };
					}
				}
				return {};
			},
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		});

		const store = storeFactory.type<TestTranslations>();

		const options: I18nModuleOptions<typeof namespaces, typeof locales, TestTranslations> = {
			store: store,
		};

		return new I18nService(store, options);
	};

	describe('t() method', () => {
		it('should return translation value for simple key', async () => {
			const service = createTestService();
			await service.loadTranslation('common', 'en');

			const greeting = service.getTranslationByKey('common.greeting');
			expect(greeting).toBe('Hello');
		});

		it('should return translation value for nested key', async () => {
			const service = createTestService();
			await service.loadTranslation('common', 'en');

			const saveButton = service.getTranslationByKey('common.buttons.save');
			expect(saveButton).toBe('Save');

			const cancelButton = service.getTranslationByKey('common.buttons.cancel');
			expect(cancelButton).toBe('Cancel');
		});

		it('should return entire namespace object when key has no dots', async () => {
			const service = createTestService();
			await service.loadTranslation('common', 'en');

			const common = service.getTranslationByKey('common');
			expect(common).toEqual({
				greeting: 'Hello',
				count: 42,
				buttons: {
					save: 'Save',
					cancel: 'Cancel',
				},
			});
		});

		it('should return non-string values', async () => {
			const service = createTestService();
			await service.loadTranslation('common', 'en');

			const count = service.getTranslationByKey('common.count');
			expect(count).toBe(42);
			expect(typeof count).toBe('number');
		});

		it('should use current locale by default', async () => {
			const service = createTestService();
			await service.loadTranslation('common', 'en');
			await service.loadTranslation('common', 'ru');

			service.setLocale('en');
			expect(service.getTranslationByKey('common.greeting')).toBe('Hello');

			service.setLocale('ru');
			expect(service.getTranslationByKey('common.greeting')).toBe('Привет');
		});

		it('should use specified locale when provided', async () => {
			const service = createTestService();
			await service.loadTranslation('common', 'en');
			await service.loadTranslation('common', 'ru');

			service.setLocale('en');
			expect(service.getTranslationByKey('common.greeting', 'ru')).toBe('Привет');
			expect(service.getTranslationByKey('common.greeting', 'en')).toBe('Hello');
		});

		it('should return key as string if translation is not loaded', () => {
			const service = createTestService();

			const result = service.getTranslationByKey('common.greeting');
			expect(result).toBe('common.greeting');
		});

		it('should return key as string if namespace does not exist', async () => {
			const service = createTestService();
			await service.loadTranslation('common', 'en');

			const result = service.getTranslationByKey('nonexistent.key' as any);
			expect(result).toBe('nonexistent.key');
		});

		it('should return key as string if nested key does not exist', async () => {
			const service = createTestService();
			await service.loadTranslation('common', 'en');

			const result = service.getTranslationByKey('common.missing.key' as any);
			expect(result).toBe('common.missing.key');
		});

		it('should work with multiple namespaces', async () => {
			const service = createTestService();
			await service.loadTranslation('common', 'en');
			await service.loadTranslation('errors', 'en');

			expect(service.getTranslationByKey('common.greeting')).toBe('Hello');
			expect(service.getTranslationByKey('errors.notFound')).toBe('Not Found');
		});
	});

	describe('setLocale', () => {
		it('should throw error for invalid locale', () => {
			const service = createTestService();

			expect(() => {
				service.setLocale('de' as any);
			}).toThrow("Invalid locale: 'de' is not a valid locale key");
		});
	});

	describe('getCurrentTranslation', () => {
		it('should return current translation if loaded', async () => {
			const service = createTestService();
			await service.loadTranslation('common', 'en');

			const translation = service.getCurrentTranslation('common');
			expect(translation).toEqual({
				greeting: 'Hello',
				count: 42,
				buttons: {
					save: 'Save',
					cancel: 'Cancel',
				},
			});
		});

		it('should return undefined if translation is not loaded', () => {
			const service = createTestService();

			const translation = service.getCurrentTranslation('common');
			expect(translation).toBeUndefined();
		});
	});

	describe('getTranslationByKeyOrThrow', () => {
		it('returns objects with a clean type — no narrowing needed', async () => {
			const service = createTestService();
			await service.loadTranslation('common', 'en');

			// The strict variant has no `| Key` union: direct property access
			const buttons = service.getTranslationByKeyOrThrow('common.buttons');
			expect(buttons.save).toBe('Save');

			expect(service.getTranslationByKeyOrThrow('common.greeting')).toBe('Hello');
		});

		it('throws TranslationMissingError when the translation is not loaded', async () => {
			const service = createTestService();

			let caught: unknown;
			try {
				service.getTranslationByKeyOrThrow('common.greeting');
			} catch (error) {
				caught = error;
			}

			expect(caught).toBeInstanceOf(Error);
			expect((caught as Error).name).toBe('TranslationMissingError');
			expect((caught as Error & { key: string; locale: string }).key).toBe('common.greeting');
			expect((caught as Error & { key: string; locale: string }).locale).toBe('en');
		});

		it('resolves through the per-request locale like getTranslationByKey', async () => {
			const service = createTestService();
			await service.loadTranslation('common', 'en');
			await service.loadTranslation('common', 'ru');

			expect(service.getTranslationByKeyOrThrow('common.greeting', 'ru')).toBe('Привет');
			expect(service.getTranslationByKeyOrThrow('common.buttons', 'ru').save).toBe('Сохранить');
		});
	});
});
