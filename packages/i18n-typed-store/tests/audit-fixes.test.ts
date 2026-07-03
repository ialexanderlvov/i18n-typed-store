import { describe, it, expect } from 'vitest';
import { smartDeepMerge } from '../src/lib/smart-merge';
import { EventEmitter } from '../src/lib/event-emitter';
import { createPluralSelector, createTranslationStore } from '../src';

/**
 * Regression tests for the audit hardening fixes.
 */
describe('audit hardening fixes (core)', () => {
	describe('smartDeepMerge', () => {
		it('copies a fallback key named like an Object.prototype member (hasOwnProperty, not `in`)', () => {
			// `toString` lives on Object.prototype; the old `!(key in result)` guard
			// dropped it. It must now be copied as a real own property.
			const result = smartDeepMerge({ greeting: 'Hi' }, JSON.parse('{"toString": "custom", "valueOf": "v"}'));
			expect(Object.prototype.hasOwnProperty.call(result, 'toString')).toBe(true);
			expect(result.toString).toBe('custom');
			expect(result.valueOf).toBe('v');
		});

		it('does not let an own __proto__ on the CURRENT object pollute the result', () => {
			const malicious = JSON.parse('{"__proto__": {"polluted": true}, "a": 1}');
			const result = smartDeepMerge(malicious, { b: 2 });

			expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
			expect((result as any).polluted).toBeUndefined();
			expect(({} as any).polluted).toBeUndefined();
			expect(result).toEqual({ a: 1, b: 2 });
		});
	});

	describe('EventEmitter', () => {
		it('isolates a throwing listener: remaining listeners still run and emit returns true', async () => {
			const emitter = new EventEmitter<{ e: [] }>();
			const calls: string[] = [];
			emitter.on('e', () => {
				calls.push('first');
				throw new Error('boom');
			});
			emitter.on('e', () => {
				calls.push('second');
			});

			// Capture the asynchronously re-thrown listener error so it doesn't
			// surface as an uncaught exception in the test runner.
			const previous = process.listeners('uncaughtException');
			process.removeAllListeners('uncaughtException');
			const caught: unknown[] = [];
			const handler = (error: unknown) => caught.push(error);
			process.on('uncaughtException', handler);

			let returned: boolean;
			try {
				returned = emitter.emit('e');
				// Let the queued microtask re-throw run.
				await new Promise((resolve) => setTimeout(resolve, 0));
			} finally {
				process.removeListener('uncaughtException', handler);
				previous.forEach((l) => process.on('uncaughtException', l as any));
			}

			expect(returned!).toBe(true);
			expect(calls).toEqual(['first', 'second']); // second ran despite first throwing
			expect((caught[0] as Error)?.message).toBe('boom'); // error was surfaced, not swallowed
		});
	});

	describe('createPluralSelector strict mode', () => {
		it('accepts an empty-string "other" variant (presence check, not truthiness)', () => {
			const select = createPluralSelector('en', { strict: true });
			expect(() => select(5, { other: '' })).not.toThrow();
			expect(select(5, { other: '' })).toBe('');
		});

		it('still throws when "other" is entirely absent in strict mode', () => {
			const select = createPluralSelector('en', { strict: true });
			expect(() => select(1, { one: 'item' } as any)).toThrow();
		});
	});

	describe('deleteOtherLocalesAfterLoad keeps the fallback locale', () => {
		it('does not wipe the freshly-loaded fallback locale', async () => {
			const factory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales: { en: 'en', ru: 'ru', fr: 'fr' } as const,
				loadModule: async (locale) => ({ greeting: String(locale) }),
				extractTranslation: (module) => module,
				defaultLocale: 'en',
				useFallback: true,
				fallbackLocale: 'en',
				deleteOtherLocalesAfterLoad: true,
			});
			const store = factory.type<{ common: { greeting: string } }>();

			store.changeLocale('fr');
			await store.translations.common.load('ru');

			// 'en' is the fallback locale that was just loaded/merged — it must survive.
			expect(store.translations.common.translations.en.namespace).toBeDefined();
			// 'ru' (resolved) is present too.
			expect(store.translations.common.translations.ru.namespace).toBeDefined();
		});
	});
});
