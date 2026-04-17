import { describe, it, expect } from 'vitest';
import { createTranslationStore, getTranslation } from '../src';
import { smartDeepMerge } from '../src/lib/smart-merge';

describe('prototype pollution / chain leak hardening', () => {
	describe('smartDeepMerge', () => {
		it('does not assign __proto__ from a fallback object (no prototype swap)', () => {
			const malicious = JSON.parse('{"__proto__": {"polluted": true}}');
			const result = smartDeepMerge({ greeting: 'Hi' }, malicious);

			expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
			expect((result as any).polluted).toBeUndefined();
			expect(({} as any).polluted).toBeUndefined();
		});

		it('does not copy constructor / prototype keys', () => {
			const malicious = JSON.parse('{"constructor": "evil", "prototype": "evil"}');
			const result = smartDeepMerge({ greeting: 'Hi' }, malicious);

			expect(result.constructor).toBe(Object);
			// Result must keep its original prototype semantics.
			expect(Object.prototype.hasOwnProperty.call(result, 'prototype')).toBe(false);
		});

		it('does not leak inherited fallback keys (only own properties merge)', () => {
			const Parent = function () {
				/* noop */
			} as unknown as { new (): { inherited: string } };
			Parent.prototype.inherited = 'leaked';
			const fallback: any = new Parent();
			fallback.legitimate = 'ok';

			const result = smartDeepMerge({ greeting: 'Hi' }, fallback);

			expect(result.legitimate).toBe('ok');
			expect(Object.prototype.hasOwnProperty.call(result, 'inherited')).toBe(false);
		});

		it('still merges when current already has __proto__-equivalent fields safely', () => {
			const result = smartDeepMerge({ a: 1 }, { b: 2 });
			expect(result).toEqual({ a: 1, b: 2 });
		});
	});

	describe('getTranslation', () => {
		const setup = async () => {
			const factory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales: { en: 'en' } as const,
				loadModule: async () => ({ greeting: 'Hi', nested: { foo: 'bar' } }),
				extractTranslation: (m) => m,
				defaultLocale: 'en',
			});
			const store = factory.type<{ common: { greeting: string; nested: { foo: string } } }>();
			await store.translations.common.load('en');
			return store;
		};

		it('returns the key string when traversing into prototype methods (toString)', async () => {
			const store = await setup();
			const r = getTranslation(store, 'common.toString' as any);
			expect(r).toBe('common.toString');
		});

		it('returns the key string for __proto__ namespace lookup', async () => {
			const store = await setup();
			const r = getTranslation(store, '__proto__' as any);
			expect(r).toBe('__proto__');
		});

		it('returns the key string for nested __proto__ traversal', async () => {
			const store = await setup();
			const r = getTranslation(store, 'common.__proto__.constructor' as any);
			expect(r).toBe('common.__proto__.constructor');
		});

		it('still resolves real own-property paths', async () => {
			const store = await setup();
			expect(getTranslation(store, 'common.greeting')).toBe('Hi');
			expect(getTranslation(store, 'common.nested.foo')).toBe('bar');
		});
	});

	describe('createTranslationStore', () => {
		it('does not accept __proto__ as a locale via changeLocale', () => {
			const factory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales: { en: 'en' } as const,
				loadModule: async () => ({}),
				extractTranslation: (m) => m,
				defaultLocale: 'en',
			});
			const store = factory.type<{ common: any }>();

			store.changeLocale('__proto__' as any);
			// Should fall back to the default locale, not adopt '__proto__'.
			expect(store.currentLocale).toBe('en');
		});

		it('does not call loadModule with __proto__ as the locale', async () => {
			const calls: Array<[string, string]> = [];
			const factory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales: { en: 'en' } as const,
				loadModule: async (locale, ns) => {
					calls.push([String(locale), String(ns)]);
					return {};
				},
				extractTranslation: (m) => m,
				defaultLocale: 'en',
			});
			const store = factory.type<{ common: any }>();

			await store.translations.common.load('__proto__' as any);

			// '__proto__' should not have been forwarded; it should have been
			// rejected and resolved to the defaultLocale.
			const forwarded = calls.map(([locale]) => locale);
			expect(forwarded).not.toContain('__proto__');
			expect(forwarded).toContain('en');
		});
	});
});
