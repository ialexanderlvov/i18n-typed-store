import { Module, DynamicModule, Global, Provider, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { I18nService } from './i18n.service';
import { I18nInterceptor } from './i18n.interceptor';
import { I18N_STORE, I18N_OPTIONS, I18N_SERVICE } from './tokens';
import { I18nModuleOptions, I18nModuleAsyncOptions } from '../types/types';

type AnyI18nService = I18nService<any, any, any>;
type AnyI18nModuleOptions = I18nModuleOptions<any, any, any>;

/**
 * Internationalization module for NestJS
 *
 * @example
 * ```ts
 * import { I18nModule } from 'i18n-typed-store-nest';
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
		return this.createModule(
			{
				provide: I18N_OPTIONS,
				useValue: this.normalizeOptions(options),
			},
			[],
			options.useGlobalInterceptor ?? true,
		);
	}

	/**
	 * Async variant of {@link forRoot}: builds the module options from a factory,
	 * so the store / defaults can come from other providers (e.g. `ConfigService`).
	 *
	 * @example
	 * ```ts
	 * I18nModule.forRootAsync({
	 *   imports: [ConfigModule],
	 *   inject: [ConfigService],
	 *   useFactory: (config: ConfigService) => ({
	 *     store,
	 *     defaultLocale: config.get('DEFAULT_LOCALE'),
	 *   }),
	 * });
	 * ```
	 */
	static forRootAsync<N extends Record<string, string>, L extends Record<string, string>, M extends { [K in keyof N]: any }>(
		options: I18nModuleAsyncOptions<N, L, M>,
	): DynamicModule {
		return this.createModule(
			{
				provide: I18N_OPTIONS,
				useFactory: async (...args: unknown[]) => this.normalizeOptions(await options.useFactory(...args)),
				inject: options.inject ?? [],
			},
			options.imports ?? [],
			// Static flag on the async options: the provider list is assembled
			// before the factory runs, so the factory result cannot control it.
			options.useGlobalInterceptor ?? true,
		);
	}

	/**
	 * Applies the shared option defaults (no preloading; `availableLocales`
	 * derived from the store) for both the sync and async entry points.
	 *
	 * Default to no preloading: eagerly loading every (namespace × locale)
	 * combination can blow up cold-start time on serverless / large translation
	 * sets. Opt in with `preload: true` (or a granular config) when you actually
	 * want eager loading.
	 */
	private static normalizeOptions<N extends Record<string, string>, L extends Record<string, string>, M extends { [K in keyof N]: any }>(
		options: I18nModuleOptions<N, L, M>,
	): I18nModuleOptions<N, L, M> {
		// Fail fast on a misconfigured default locale: every downstream fallback
		// (detection, ws/rpc requests, `resolveLocale`) assumes it is a real
		// store key. A typo here would otherwise surface as confusing runtime
		// lookups on a non-existent locale slot.
		if (
			options.defaultLocale !== undefined &&
			!Object.prototype.hasOwnProperty.call(options.store.locales, options.defaultLocale as PropertyKey)
		) {
			throw new Error(
				`I18nModule configuration error: defaultLocale '${String(options.defaultLocale)}' is not a key of store.locales. ` +
					`Available locales: ${Object.keys(options.store.locales)
						.map((key) => `'${key}'`)
						.join(', ')}.`,
			);
		}

		return {
			...options,
			preload: options.preload ?? false,
			availableLocales: options.availableLocales ?? (Object.keys(options.store.locales) as Array<keyof L>),
		};
	}

	/**
	 * Builds the DynamicModule from a configured `I18N_OPTIONS` provider. The
	 * store is derived from the resolved options so the same wiring works for
	 * both `forRoot` (static options) and `forRootAsync` (factory options).
	 */
	private static createModule(
		optionsProvider: Provider,
		imports: DynamicModule['imports'] = [],
		useGlobalInterceptor: boolean = true,
	): DynamicModule {
		const storeProvider: Provider = {
			provide: I18N_STORE,
			useFactory: (options: AnyI18nModuleOptions) => options.store,
			inject: [I18N_OPTIONS],
		};

		const serviceProvider: Provider = {
			provide: I18N_SERVICE,
			useClass: I18nService,
		};

		// I18nInterceptor is always provided (and exported) so it can be wired
		// manually via `@UseInterceptors(I18nInterceptor)` / `app.get(...)` when
		// the global registration is opted out of.
		const providers: Provider[] = [optionsProvider, storeProvider, serviceProvider, I18nService, I18nInterceptor];

		if (useGlobalInterceptor) {
			providers.push({
				provide: APP_INTERCEPTOR,
				useExisting: I18nInterceptor,
			});
		}

		return {
			module: I18nModule,
			imports,
			providers,
			exports: [I18nService, I18nInterceptor, I18N_SERVICE, I18N_STORE, I18N_OPTIONS],
		};
	}

	private readonly logger = new Logger(I18nModule.name);

	constructor(
		@Inject(I18N_SERVICE)
		private readonly i18nService: AnyI18nService,
		@Inject(I18N_OPTIONS)
		private readonly options: AnyI18nModuleOptions,
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

			// Load all combinations in parallel. Use allSettled (not Promise.all):
			// preloading is a cache warm-up, and a single missing/broken translation
			// file should NOT crash application bootstrap — it can still be loaded
			// lazily at request time. Failures are logged instead.
			const tasks = namespacesToLoad.flatMap((namespace) =>
				localesToLoad.map((locale) => ({
					namespace,
					locale,
					promise: this.i18nService.loadTranslation(namespace, locale, fromCache),
				})),
			);

			const results = await Promise.allSettled(tasks.map((task) => task.promise));

			results.forEach((result, index) => {
				if (result.status === 'rejected') {
					const { namespace, locale } = tasks[index];
					this.logger.warn(
						`Failed to preload translation "${String(namespace)}" for locale "${String(locale)}": ` +
							`${result.reason instanceof Error ? result.reason.message : String(result.reason)}. ` +
							`It will be loaded lazily on first use.`,
					);
				}
			});
		}
	}
}
