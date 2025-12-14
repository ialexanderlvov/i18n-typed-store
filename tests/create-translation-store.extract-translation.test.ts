import { describe, it, expect, vi } from 'vitest';
import { createTranslationStore } from '../src/utils/create-translation-store';

describe('createTranslationStore - extractTranslation with all parameters', () => {
	describe('Using module, locale, and translation parameters', () => {
		it('should use all three parameters for conditional extraction based on locale and translation', async () => {
			const translations = {
				common: 'common',
				errors: 'errors',
			} as const;
			const locales = {
				en: 'en',
				ru: 'ru',
				ar: 'ar',
			} as const;

			const loadModule = vi.fn(async () => ({
				// Complex module structure with nested data
				data: {
					common: {
						en: { title: 'Title', description: 'Description' },
						ru: { title: 'Заголовок', description: 'Описание' },
						ar: { title: 'عنوان', description: 'وصف' },
					},
					errors: {
						en: { notFound: 'Not Found', serverError: 'Server Error' },
						ru: { notFound: 'Не найдено', serverError: 'Ошибка сервера' },
						ar: { notFound: 'غير موجود', serverError: 'خطأ في الخادم' },
					},
				},
			}));

			const extractTranslation = vi.fn((module: any, locale: string, translation: string) => {
				// Use all three parameters to extract the correct nested data
				return module.data[translation][locale];
			});

			const storeFactory = createTranslationStore(translations, locales, loadModule, extractTranslation);
			const store = storeFactory.type<{
				common: { title: string; description: string };
				errors: { notFound: string; serverError: string };
			}>();

			// Test common translations for different locales
			await store.common.load('en');
			expect(extractTranslation).toHaveBeenCalledWith(expect.any(Object), 'en', 'common');
			expect(store.common.translation).toEqual({ title: 'Title', description: 'Description' });

			await store.common.load('ru');
			expect(extractTranslation).toHaveBeenCalledWith(expect.any(Object), 'ru', 'common');
			expect(store.common.translation).toEqual({ title: 'Заголовок', description: 'Описание' });

			await store.common.load('ar');
			expect(extractTranslation).toHaveBeenCalledWith(expect.any(Object), 'ar', 'common');
			expect(store.common.translation).toEqual({ title: 'عنوان', description: 'وصف' });

			// Test errors translations
			await store.errors.load('ru');
			expect(extractTranslation).toHaveBeenCalledWith(expect.any(Object), 'ru', 'errors');
			expect(store.errors.translation).toEqual({
				notFound: 'Не найдено',
				serverError: 'Ошибка сервера',
			});
		});

		it('should use locale parameter for RTL/LTR text direction handling', async () => {
			const translations = { ui: 'ui' } as const;
			const locales = { en: 'en', ar: 'ar', he: 'he' } as const;

			const loadModule = vi.fn(async () => ({
				text: 'Some text',
				direction: 'ltr',
			}));

			const extractTranslation = vi.fn((module: any, locale: string, translation: string) => {
				// Use locale to determine text direction
				const rtlLocales = ['ar', 'he', 'fa', 'ur'];
				const direction = rtlLocales.includes(locale) ? 'rtl' : 'ltr';

				return {
					...module,
					direction,
					locale,
					translationKey: translation,
				};
			});

			const storeFactory = createTranslationStore(translations, locales, loadModule, extractTranslation);
			const store = storeFactory.type<{
				ui: { text: string; direction: string; locale: string; translationKey: string };
			}>();

			await store.ui.load('en');
			expect(store.ui.translation?.direction).toBe('ltr');
			expect(store.ui.translation?.locale).toBe('en');
			expect(store.ui.translation?.translationKey).toBe('ui');

			await store.ui.load('ar');
			expect(store.ui.translation?.direction).toBe('rtl');
			expect(store.ui.translation?.locale).toBe('ar');
		});

		it('should use translation parameter to apply namespace-specific transformations', async () => {
			const translations = {
				common: 'common',
				admin: 'admin',
				public: 'public',
			} as const;
			const locales = { en: 'en' } as const;

			const loadModule = vi.fn(async () => ({
				raw: 'raw data',
				metadata: { version: '1.0', timestamp: Date.now() },
			}));

			const extractTranslation = vi.fn((module: any, locale: string, translation: string) => {
				// Use translation key to determine if we need to strip metadata
				const publicTranslations = ['public', 'common'];
				if (publicTranslations.includes(translation)) {
					// Public translations: return only raw data
					return module.raw;
				} else {
					// Admin translations: include metadata
					return {
						data: module.raw,
						metadata: module.metadata,
						namespace: translation,
						locale,
					};
				}
			});

			const storeFactory = createTranslationStore(translations, locales, loadModule, extractTranslation);
			const store = storeFactory.type<{
				common: string;
				admin: { data: string; metadata: any; namespace: string; locale: string };
				public: string;
			}>();

			await store.common.load('en');
			expect(extractTranslation).toHaveBeenCalledWith(expect.any(Object), 'en', 'common');
			expect(store.common.translation).toBe('raw data');

			await store.admin.load('en');
			expect(extractTranslation).toHaveBeenCalledWith(expect.any(Object), 'en', 'admin');
			expect(store.admin.translation?.namespace).toBe('admin');
			expect(store.admin.translation?.locale).toBe('en');
			expect(store.admin.translation?.metadata).toBeDefined();

			await store.public.load('en');
			expect(store.public.translation).toBe('raw data');
		});

		it('should use all parameters for locale-specific and translation-specific validation', async () => {
			const translations = {
				common: 'common',
				errors: 'errors',
			} as const;
			const locales = { en: 'en', ru: 'ru' } as const;

			const loadModule = vi.fn(async (locale: string, translation: string) => ({
				content: `${translation}-${locale}`,
				valid: true,
			}));

			const extractTranslation = vi.fn((module: any, locale: string, translation: string) => {
				// Validate based on all three parameters
				if (!module.valid) {
					throw new Error(`Invalid module for ${translation} in ${locale}`);
				}

				// Apply locale-specific formatting
				if (locale === 'ru' && translation === 'errors') {
					return {
						...module.content,
						formatted: `[RU-ERROR] ${module.content}`,
						locale,
						translation,
					};
				}

				return {
					content: module.content,
					formatted: `[${locale.toUpperCase()}] ${module.content}`,
					locale,
					translation,
				};
			});

			const storeFactory = createTranslationStore(translations, locales, loadModule, extractTranslation);
			const store = storeFactory.type<{
				common: { content: string; formatted: string; locale: string; translation: string };
				errors: { content: string; formatted: string; locale: string; translation: string };
			}>();

			await store.common.load('en');
			expect(store.common.translation?.formatted).toBe('[EN] common-en');
			expect(store.common.translation?.locale).toBe('en');
			expect(store.common.translation?.translation).toBe('common');

			await store.errors.load('ru');
			expect(store.errors.translation?.formatted).toBe('[RU-ERROR] errors-ru');
			expect(store.errors.translation?.locale).toBe('ru');
			expect(store.errors.translation?.translation).toBe('errors');
		});

		it('should use module structure with locale and translation for dynamic path resolution', async () => {
			const translations = {
				ui: 'ui',
				api: 'api',
			} as const;
			const locales = { en: 'en', fr: 'fr' } as const;

			const loadModule = vi.fn(async () => ({
				translations: {
					ui: {
						en: { buttons: { save: 'Save' } },
						fr: { buttons: { save: 'Enregistrer' } },
					},
					api: {
						en: { messages: { success: 'Success' } },
						fr: { messages: { success: 'Succès' } },
					},
				},
			}));

			const extractTranslation = vi.fn((module: any, locale: string, translation: string) => {
				// Dynamically resolve path using all three parameters
				const path = `translations.${translation}.${locale}`;
				const parts = path.split('.');
				let result: any = module;
				for (const part of parts) {
					result = result?.[part];
				}
				return result;
			});

			const storeFactory = createTranslationStore(translations, locales, loadModule, extractTranslation);
			const store = storeFactory.type<{
				ui: { buttons: { save: string } };
				api: { messages: { success: string } };
			}>();

			await store.ui.load('en');
			expect(store.ui.translation?.buttons.save).toBe('Save');

			await store.ui.load('fr');
			expect(store.ui.translation?.buttons.save).toBe('Enregistrer');

			await store.api.load('fr');
			expect(store.api.translation?.messages.success).toBe('Succès');
		});

		it('should use all parameters for caching key generation', async () => {
			const translations = { common: 'common' } as const;
			const locales = { en: 'en', ru: 'ru' } as const;

			const cache = new Map<string, any>();

			const loadModule = vi.fn(async () => ({
				data: 'translation data',
			}));

			const extractTranslation = vi.fn((module: any, locale: string, translation: string) => {
				// Generate cache key using all three parameters
				const cacheKey = `${translation}-${locale}`;
				if (cache.has(cacheKey)) {
					return cache.get(cacheKey);
				}

				const extracted = {
					data: module.data,
					cacheKey,
					locale,
					translation,
					timestamp: Date.now(),
				};

				cache.set(cacheKey, extracted);
				return extracted;
			});

			const storeFactory = createTranslationStore(translations, locales, loadModule, extractTranslation);
			const store = storeFactory.type<{
				common: { data: string; cacheKey: string; locale: string; translation: string; timestamp: number };
			}>();

			await store.common.load('en');
			const firstLoad = store.common.translation;
			expect(firstLoad?.cacheKey).toBe('common-en');
			expect(firstLoad?.locale).toBe('en');
			expect(firstLoad?.translation).toBe('common');

			// Load again - should use cache
			await store.common.load('en');
			expect(store.common.translation?.cacheKey).toBe('common-en');
			expect(store.common.translation?.timestamp).toBe(firstLoad?.timestamp);

			await store.common.load('ru');
			expect(store.common.translation?.cacheKey).toBe('common-ru');
			expect(store.common.translation?.locale).toBe('ru');
		});

		it('should use all parameters for logging and debugging', async () => {
			const translations = { common: 'common' } as const;
			const locales = { en: 'en' } as const;

			const logs: Array<{ module: any; locale: string; translation: string }> = [];

			const loadModule = vi.fn(async () => ({
				data: 'test',
			}));

			const extractTranslation = vi.fn((module: any, locale: string, translation: string) => {
				// Log all parameters for debugging
				logs.push({ module, locale, translation });

				console.log(`Extracting ${translation} for locale ${locale}`);
				console.log('Module structure:', Object.keys(module));

				return {
					data: module.data,
					extractedAt: new Date().toISOString(),
					context: { locale, translation },
				};
			});

			const storeFactory = createTranslationStore(translations, locales, loadModule, extractTranslation);
			const store = storeFactory.type<{
				common: { data: string; extractedAt: string; context: { locale: string; translation: string } };
			}>();

			await store.common.load('en');

			expect(logs).toHaveLength(1);
			expect(logs[0].locale).toBe('en');
			expect(logs[0].translation).toBe('common');
			expect(store.common.translation?.context.locale).toBe('en');
			expect(store.common.translation?.context.translation).toBe('common');
		});

		it('should use all parameters for conditional feature flags', async () => {
			const translations = {
				features: 'features',
				legacy: 'legacy',
			} as const;
			const locales = { en: 'en', ru: 'ru' } as const;

			const loadModule = vi.fn(async () => ({
				newFeature: { enabled: true, text: 'New Feature' },
				oldFeature: { enabled: false, text: 'Old Feature' },
			}));

			const extractTranslation = vi.fn((module: any, locale: string, translation: string) => {
				// Use translation key to determine feature set
				const isLegacy = translation === 'legacy';
				// Use locale to determine if features should be enabled
				const betaLocales = ['en'];

				const result: any = {};
				for (const [key, value] of Object.entries(module)) {
					const feature = value as { enabled: boolean; text: string };
					// Enable features based on translation namespace and locale
					if (isLegacy || (betaLocales.includes(locale) && feature.enabled)) {
						result[key] = {
							...feature,
							enabled: true,
							locale,
							namespace: translation,
						};
					}
				}
				return result;
			});

			const storeFactory = createTranslationStore(translations, locales, loadModule, extractTranslation);
			const store = storeFactory.type<{
				features: Record<string, { enabled: boolean; text: string; locale: string; namespace: string }>;
				legacy: Record<string, { enabled: boolean; text: string; locale: string; namespace: string }>;
			}>();

			await store.features.load('en');
			expect(store.features.translation?.newFeature?.enabled).toBe(true);
			expect(store.features.translation?.newFeature?.locale).toBe('en');
			expect(store.features.translation?.newFeature?.namespace).toBe('features');

			await store.features.load('ru');
			// Russian locale not in beta, so features might be disabled
			expect(store.features.translation).toBeDefined();

			await store.legacy.load('en');
			expect(store.legacy.translation?.oldFeature?.enabled).toBe(true);
			expect(store.legacy.translation?.oldFeature?.namespace).toBe('legacy');
		});

		it('should use all parameters for A/B testing different translation versions', async () => {
			const translations = { ui: 'ui' } as const;
			const locales = { en: 'en' } as const;

			const loadModule = vi.fn(async () => ({
				versionA: { title: 'Version A Title' },
				versionB: { title: 'Version B Title' },
			}));

			const extractTranslation = vi.fn((module: any, locale: string, translation: string) => {
				// Use locale and translation to determine A/B test variant
				// For example: hash locale + translation to get consistent variant
				const hash = (locale + translation).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
				const variant = hash % 2 === 0 ? 'versionA' : 'versionB';

				return {
					...module[variant],
					variant,
					locale,
					translation,
					hash,
				};
			});

			const storeFactory = createTranslationStore(translations, locales, loadModule, extractTranslation);
			const store = storeFactory.type<{
				ui: { title: string; variant: string; locale: string; translation: string; hash: number };
			}>();

			await store.ui.load('en');
			expect(store.ui.translation?.variant).toMatch(/version(A|B)/);
			expect(store.ui.translation?.locale).toBe('en');
			expect(store.ui.translation?.translation).toBe('ui');
			expect(store.ui.translation?.hash).toBeDefined();
		});

		it('should use all parameters for building complete translation context', async () => {
			const translations = {
				common: 'common',
				errors: 'errors',
			} as const;
			const locales = { en: 'en', ru: 'ru' } as const;

			const loadModule = vi.fn(async () => ({
				text: 'Translation text',
			}));

			const extractTranslation = vi.fn((module: any, locale: string, translation: string) => {
				// Build complete context using all parameters
				return {
					...module,
					// Add locale information
					localeInfo: {
						code: locale,
						isRTL: ['ar', 'he', 'fa'].includes(locale),
						dateFormat: locale === 'en' ? 'MM/DD/YYYY' : 'DD.MM.YYYY',
					},
					// Add translation namespace info
					namespaceInfo: {
						key: translation,
						isPublic: ['common', 'public'].includes(translation),
						requiresAuth: ['admin', 'private'].includes(translation),
					},
					// Add combined context
					fullContext: {
						locale,
						translation,
						path: `${translation}/${locale}`,
						timestamp: Date.now(),
					},
				};
			});

			const storeFactory = createTranslationStore(translations, locales, loadModule, extractTranslation);
			const store = storeFactory.type<{
				common: {
					text: string;
					localeInfo: { code: string; isRTL: boolean; dateFormat: string };
					namespaceInfo: { key: string; isPublic: boolean; requiresAuth: boolean };
					fullContext: { locale: string; translation: string; path: string; timestamp: number };
				};
				errors: {
					text: string;
					localeInfo: { code: string; isRTL: boolean; dateFormat: string };
					namespaceInfo: { key: string; isPublic: boolean; requiresAuth: boolean };
					fullContext: { locale: string; translation: string; path: string; timestamp: number };
				};
			}>();

			await store.common.load('en');
			expect(store.common.translation?.localeInfo.code).toBe('en');
			expect(store.common.translation?.localeInfo.isRTL).toBe(false);
			expect(store.common.translation?.namespaceInfo.isPublic).toBe(true);
			expect(store.common.translation?.fullContext.path).toBe('common/en');

			await store.errors.load('ru');
			expect(store.errors.translation?.localeInfo.code).toBe('ru');
			expect(store.errors.translation?.namespaceInfo.key).toBe('errors');
			expect(store.errors.translation?.fullContext.path).toBe('errors/ru');
		});
	});
});
