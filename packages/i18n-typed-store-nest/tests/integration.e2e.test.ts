// @vitest-environment node
import 'reflect-metadata';
import { describe, it, expect, afterEach } from 'vitest';
import { Controller, Get, Inject, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { createTranslationStore } from 'i18n-typed-store';
import { I18nModule, I18nService, I18N_SERVICE, Translation } from '../src';

/**
 * REAL end-to-end integration tests: a full Nest application (express
 * platform) is bootstrapped via Test.createTestingModule + app.init(), an
 * actual HTTP server listens on an ephemeral port and is exercised with
 * concurrent fetch() calls.
 *
 * Primary regression: the per-request locale race. The core store keeps ONE
 * shared `currentTranslation` slot per namespace which every `load()` of any
 * request overwrites. `I18nService.getCurrentTranslation` used to read that
 * shared slot, so two concurrent requests with different locales could serve
 * each other's translations. It now reads the per-locale cache slot via the
 * AsyncLocalStorage-bound request locale.
 */

const namespaces = { common: 'common', broken: 'broken' } as const;
const locales = { en: 'en', ru: 'ru' } as const;

type Translations = {
	common: { greeting: string };
	broken: { anything: string };
};

/** Milliseconds each translation module load is artificially delayed by. */
const LOAD_DELAY_MS = 50;

const createTestStore = () => {
	const storeFactory = createTranslationStore({
		namespaces,
		locales,
		loadModule: async (locale, namespace) => {
			// Artificial delay guarantees that concurrent requests' loads
			// overlap in time, so the shared `currentTranslation` slot is
			// overwritten by whichever load lands last.
			await new Promise((resolve) => setTimeout(resolve, LOAD_DELAY_MS));
			if (namespace === 'broken') {
				throw new Error('broken namespace never loads');
			}
			return { greeting: locale === 'ru' ? 'Привет' : 'Hello' };
		},
		extractTranslation: (module) => module,
		defaultLocale: 'en',
	});
	return storeFactory.type<Translations>();
};

@Controller()
class GreetingController {
	constructor(
		@Inject(I18N_SERVICE)
		private readonly i18n: I18nService<typeof namespaces, typeof locales, Translations>,
	) {}

	@Get('greeting')
	async greeting() {
		await this.i18n.loadTranslation('common');
		// Extra pause AFTER our own load: gives the concurrent request's load
		// time to land on the shared `currentTranslation` slot. Reading the
		// shared slot here (the old bug) would now return the OTHER request's
		// locale; the per-request read must still return ours.
		await new Promise((resolve) => setTimeout(resolve, LOAD_DELAY_MS));
		const translation = this.i18n.getCurrentTranslation('common');
		return { locale: String(this.i18n.getLocale()), greeting: translation?.greeting };
	}

	@Get('with-translation-param')
	async withTranslationParam(@Translation('broken') translation: Translations['broken'] | undefined) {
		return { loaded: translation !== undefined };
	}
}

describe('I18nModule end-to-end (real Nest app over HTTP)', () => {
	let app: INestApplication | undefined;

	const bootstrap = async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [
				I18nModule.forRoot({
					store: createTestStore(),
					defaultLocale: 'en',
				}),
			],
			controllers: [GreetingController],
		}).compile();

		app = moduleRef.createNestApplication({ logger: false });
		await app.init();
		await app.listen(0);
		const address = app.getHttpServer().address() as AddressInfo;
		return `http://127.0.0.1:${address.port}`;
	};

	afterEach(async () => {
		await app?.close();
		app = undefined;
	});

	it('serves each of two concurrent requests its OWN locale (shared-slot race regression)', async () => {
		const baseUrl = await bootstrap();

		// Fire both requests concurrently; loads (50ms each) fully overlap and
		// each handler re-reads only after BOTH loads have completed, so the
		// shared slot definitely holds a single winner by read time.
		const [enResponse, ruResponse] = await Promise.all([
			fetch(`${baseUrl}/greeting?locale=en`).then((res) => res.json()),
			fetch(`${baseUrl}/greeting?locale=ru`).then((res) => res.json()),
		]);

		expect(enResponse).toEqual({ locale: 'en', greeting: 'Hello' });
		expect(ruResponse).toEqual({ locale: 'ru', greeting: 'Привет' });
	});

	it('resolves a BCP 47 query tag to the store key end-to-end (?locale=ru-RU -> ru)', async () => {
		const baseUrl = await bootstrap();

		const response = await fetch(`${baseUrl}/greeting?locale=ru-RU`).then((res) => res.json());

		expect(response).toEqual({ locale: 'ru', greeting: 'Привет' });
	});

	it('resolves a case-mismatched Accept-Language header end-to-end (RU-ru -> ru)', async () => {
		const baseUrl = await bootstrap();

		const response = await fetch(`${baseUrl}/greeting`, {
			headers: { 'accept-language': 'RU-ru,en;q=0.5' },
		}).then((res) => res.json());

		expect(response).toEqual({ locale: 'ru', greeting: 'Привет' });
	});

	it('@Translation() with a failing loader yields undefined instead of a 500', async () => {
		const baseUrl = await bootstrap();

		const response = await fetch(`${baseUrl}/with-translation-param`);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ loaded: false });
	});
});
