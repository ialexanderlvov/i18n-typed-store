import { Module, DynamicModule, Global, Provider, OnModuleInit, Inject } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { I18nService } from './i18n.service';
import { I18nInterceptor } from './i18n.interceptor';
import { I18N_STORE, I18N_OPTIONS, I18N_SERVICE } from './tokens';
import { I18nModuleOptions } from '../types/types';

/**
 * Internationalization module for NestJS
 *
 * @example
 * ```ts
 * import { I18nModule } from 'i18n-typed-store/nestjs';
 * import { store } from './i18n/store';
 *
 * @Module({
 *   imports: [
 *     I18nModule.forRoot({
 *       store,
 *       defaultLocale: 'en',
 *       availableLocales: ['en', 'ru'],
 *       // Preload all translations on module initialization
 *       preload: true,
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 *
 * @example
 * ```ts
 * // Preload specific namespaces and locales
 * I18nModule.forRoot({
 *   store,
 *   defaultLocale: 'en',
 *   preload: {
 *     namespaces: ['common', 'errors'],
 *     locales: ['en', 'ru'],
 *   },
 * })
 * ```
 */
@Global()
@Module({})
export class I18nModule implements OnModuleInit {
	static forRoot<N extends Record<string, string>, L extends Record<string, string>, M extends { [K in keyof N]: any }>(
		options: I18nModuleOptions<N, L, M>,
	): DynamicModule {
		const storeProvider: Provider = {
			provide: I18N_STORE,
			useValue: options.store,
		};

		const optionsProvider: Provider = {
			provide: I18N_OPTIONS,
			useValue: {
				...options,
				preload: options.preload ?? true, // Default to true if not specified
				availableLocales: options.availableLocales ?? Object.keys(options.store.locales),
			} as typeof options,
		};

		const serviceProvider: Provider = {
			provide: I18N_SERVICE,
			useClass: I18nService,
		};

		return {
			module: I18nModule,
			providers: [
				storeProvider,
				optionsProvider,
				serviceProvider,
				I18nService,
				{
					provide: APP_INTERCEPTOR,
					useClass: I18nInterceptor,
				},
			],
			exports: [I18nService, I18N_SERVICE, I18N_STORE, I18N_OPTIONS],
		};
	}

	constructor(
		@Inject(I18N_SERVICE)
		private readonly i18nService: I18nService,
		@Inject(I18N_OPTIONS)
		private readonly options: I18nModuleOptions,
	) {}

	async onModuleInit() {
		// Set default locale if specified
		if (this.options.defaultLocale) {
			this.i18nService.setLocale(this.options.defaultLocale);
		}

		// Preload translations if configured
		if (this.options.preload) {
			const store = this.i18nService.getStore();
			const allNamespaces = Object.keys(store.translationsMap) as Array<keyof typeof store.translationsMap>;
			const allLocales = Object.keys(store.locales) as Array<keyof typeof store.locales>;

			const namespacesToLoad = this.options.preload === true ? allNamespaces : (this.options.preload.namespaces ?? allNamespaces);

			const localesToLoad = this.options.preload === true ? allLocales : (this.options.preload.locales ?? allLocales);

			const fromCache = this.options.preload === true ? true : (this.options.preload.fromCache ?? true);

			// Load all combinations in parallel
			const loadPromises: Promise<void>[] = [];

			for (const namespace of namespacesToLoad) {
				for (const locale of localesToLoad) {
					loadPromises.push(this.i18nService.loadTranslation(namespace, locale, fromCache));
				}
			}

			await Promise.all(loadPromises);
		}
	}
}
