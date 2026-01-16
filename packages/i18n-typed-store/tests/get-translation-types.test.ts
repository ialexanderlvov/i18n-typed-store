import { describe, it, expect } from 'vitest';
import { createTranslationStore, getTranslation } from '../src';
import type { TranslationKeys } from '../src';

/**
 * Type tests for getTranslation function.
 * These tests verify that TypeScript correctly infers and validates translation keys.
 */
describe('getTranslation type safety', () => {
	const namespaces = { common: 'common', errors: 'errors' } as const;
	const locales = { en: 'en', ru: 'ru' } as const;

	type TestTranslations = {
		common: {
			greeting: string;
			buttons: {
				save: string;
				cancel: string;
			};
			forms: {
				user: {
					name: {
						label: string;
					};
				};
			};
		};
		errors: {
			notFound: string;
			unauthorized: string;
		};
	};

	it('should correctly infer translation keys type including intermediate paths', () => {
		// This is a compile-time test - if this compiles, the type is correct
		type Keys = TranslationKeys<TestTranslations>;
		// Keys should include:
		// - Namespace keys: "common" | "errors"
		// - Intermediate paths: "common.buttons" | "common.forms" | "common.forms.user" | "common.forms.user.name"
		// - Leaf nodes: "common.greeting" | "common.buttons.save" | "common.buttons.cancel" |
		//               "common.forms.user.name.label" | "errors.notFound" | "errors.unauthorized"

		// Type assertion to verify the type structure includes all paths
		const _validKeys: Keys[] = [
			// Namespace keys
			'common',
			'errors',
			// Intermediate paths
			'common.buttons',
			'common.forms',
			'common.forms.user',
			'common.forms.user.name',
			// Leaf nodes
			'common.greeting',
			'common.buttons.save',
			'common.buttons.cancel',
			'common.forms.user.name.label',
			'errors.notFound',
			'errors.unauthorized',
		];

		// This should cause a TypeScript error if uncommented:
		// const _invalidKey: Keys = 'common.invalid.key'; // Should error
		// const _invalidKey2: Keys = 'nonexistent.key'; // Should error

		expect(true).toBe(true); // Placeholder assertion
	});

	it('should accept valid keys at runtime', async () => {
		const storeFactory = createTranslationStore({
			namespaces,
			locales,
			loadModule: async () => ({
				greeting: 'Hello',
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

		const store = storeFactory.type<TestTranslations>();

		await store.translations.common.load('en');
		await store.translations.errors.load('en');

		// These should all be valid at compile time
		const greeting = getTranslation(store, 'common.greeting');
		const saveButton = getTranslation(store, 'common.buttons.save');
		const cancelButton = getTranslation(store, 'common.buttons.cancel');
		const nameLabel = getTranslation(store, 'common.forms.user.name.label');
		const notFound = getTranslation(store, 'errors.notFound');
		const unauthorized = getTranslation(store, 'errors.unauthorized');

		expect(greeting).toBe('Hello');
		expect(saveButton).toBe('Save');
		expect(cancelButton).toBe('Cancel');
		expect(nameLabel).toBe('Name');
		expect(notFound).toBeDefined();
		expect(unauthorized).toBeDefined();
	});

	it('should handle simple flat translations', async () => {
		type SimpleTranslations = {
			common: {
				greeting: string;
				goodbye: string;
			};
		};

		const storeFactory = createTranslationStore({
			namespaces: { common: 'common' } as const,
			locales,
			loadModule: async () => ({
				greeting: 'Hello',
				goodbye: 'Goodbye',
			}),
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		});

		const store = storeFactory.type<SimpleTranslations>();

		await store.translations.common.load('en');

		const greeting = getTranslation(store, 'common.greeting');
		const goodbye = getTranslation(store, 'common.goodbye');

		expect(greeting).toBe('Hello');
		expect(goodbye).toBe('Goodbye');
	});

	it('should handle intermediate object paths', async () => {
		type NestedTranslations = {
			common: {
				buttons: {
					save: string;
					cancel: string;
				};
			};
		};

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

		const store = storeFactory.type<NestedTranslations>();

		await store.translations.common.load('en');

		// Get intermediate object path
		const buttons = getTranslation(store, 'common.buttons');
		expect(buttons).toEqual({ save: 'Save', cancel: 'Cancel' });
		expect(typeof buttons).toBe('object');

		// Get leaf node
		const save = getTranslation(store, 'common.buttons.save');
		expect(save).toBe('Save');
	});

	it('should handle namespace keys without dots', async () => {
		type NamespaceTranslations = {
			common: {
				greeting: string;
				count: number;
			};
		};

		const storeFactory = createTranslationStore({
			namespaces: { common: 'common' } as const,
			locales,
			loadModule: async () => ({
				greeting: 'Hello',
				count: 42,
			}),
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		});

		const store = storeFactory.type<NamespaceTranslations>();

		await store.translations.common.load('en');

		// Get entire namespace object
		const common = getTranslation(store, 'common');
		expect(common).toEqual({ greeting: 'Hello', count: 42 });
		expect(typeof common).toBe('object');
	});

	it('should handle non-string values (numbers, functions, booleans)', async () => {
		const handler = () => console.log('test');
		type MixedTranslations = {
			common: {
				greeting: string;
				count: number;
				enabled: boolean;
				handler: () => void;
				config: {
					timeout: number;
					retries: number;
				};
			};
		};

		const storeFactory = createTranslationStore({
			namespaces: { common: 'common' } as const,
			locales,
			loadModule: async () => ({
				greeting: 'Hello',
				count: 42,
				enabled: true,
				handler,
				config: {
					timeout: 5000,
					retries: 3,
				},
			}),
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		});

		const store = storeFactory.type<MixedTranslations>();

		await store.translations.common.load('en');

		const greeting = getTranslation(store, 'common.greeting');
		const count = getTranslation(store, 'common.count');
		const enabled = getTranslation(store, 'common.enabled');
		const handlerValue = getTranslation(store, 'common.handler');
		const timeout = getTranslation(store, 'common.config.timeout');
		const retries = getTranslation(store, 'common.config.retries');

		expect(greeting).toBe('Hello');
		expect(count).toBe(42);
		expect(enabled).toBe(true);
		expect(handlerValue).toBe(handler);
		expect(timeout).toBe(5000);
		expect(retries).toBe(3);
	});
});
