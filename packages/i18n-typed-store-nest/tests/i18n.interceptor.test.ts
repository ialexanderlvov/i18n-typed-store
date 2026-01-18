import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { createTranslationStore } from 'i18n-typed-store';
import { I18nModuleOptions, I18nService, I18nInterceptor } from '../src';

describe('I18nInterceptor', () => {
	const namespaces = { common: 'common' } as const;
	const locales = { en: 'en', ru: 'ru' } as const;

	const createTestInterceptor = (options?: Partial<I18nModuleOptions>) => {
		const storeFactory = createTranslationStore({
			namespaces,
			locales,
			loadModule: async () => ({}),
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		});

		const store = storeFactory.type<{ common: any }>();

		const service = new I18nService(store, {
			store,
			...options,
		} as I18nModuleOptions);

		const interceptorOptions: I18nModuleOptions = {
			store,
			queryParamName: 'locale',
			cookieName: 'locale',
			headerName: 'accept-language',
			parseAcceptLanguage: true,
			availableLocales: ['en', 'ru'],
			defaultLocale: 'en',
			...options,
		};

		// Create interceptor with mocked dependencies
		const interceptor = new I18nInterceptor(service, interceptorOptions);

		return { interceptor, service, store };
	};

	const createExecutionContext = (request: any): ExecutionContext => {
		return {
			switchToHttp: () => ({
				getRequest: () => request,
				getResponse: () => ({}),
			}),
		} as ExecutionContext;
	};

	const createCallHandler = (): CallHandler => {
		return {
			handle: () => of({}),
		} as CallHandler;
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should attach I18nService to request', () => {
		const { interceptor, service } = createTestInterceptor();
		const request: any = {};
		const ctx = createExecutionContext(request);
		const handler = createCallHandler();

		interceptor.intercept(ctx, handler).subscribe();

		expect(request.i18nService).toBe(service);
	});

	it('should extract locale from query parameter', () => {
		const { interceptor, service } = createTestInterceptor();
		const request: any = {
			query: { locale: 'ru' },
			headers: {},
			cookies: {},
			params: {},
		};
		const ctx = createExecutionContext(request);
		const handler = createCallHandler();

		interceptor.intercept(ctx, handler).subscribe();

		expect(service.getLocale()).toBe('ru');
	});

	it('should extract locale from cookie', () => {
		const { interceptor, service } = createTestInterceptor();
		const request: any = {
			cookies: { locale: 'ru' },
			headers: {},
			query: {},
			params: {},
		};
		const ctx = createExecutionContext(request);
		const handler = createCallHandler();

		interceptor.intercept(ctx, handler).subscribe();

		expect(service.getLocale()).toBe('ru');
	});

	it('should extract locale from header', () => {
		const { interceptor, service } = createTestInterceptor();
		const request: any = {
			headers: { 'accept-language': 'ru' },
			query: {},
			cookies: {},
			params: {},
		};
		const ctx = createExecutionContext(request);
		const handler = createCallHandler();

		interceptor.intercept(ctx, handler).subscribe();

		expect(service.getLocale()).toBe('ru');
	});

	it('should use default locale if no locale found', () => {
		const { interceptor, service } = createTestInterceptor({ defaultLocale: 'ru' });
		const request: any = {
			headers: {},
			query: {},
			cookies: {},
			params: {},
		};
		const ctx = createExecutionContext(request);
		const handler = createCallHandler();

		interceptor.intercept(ctx, handler).subscribe();

		expect(service.getLocale()).toBe('ru');
	});

	it('should not set locale if extracted locale is not in available locales', () => {
		const { interceptor, service } = createTestInterceptor();
		service.setLocale('en');
		const request: any = {
			query: { locale: 'de' },
			headers: {},
			cookies: {},
			params: {},
		};
		const ctx = createExecutionContext(request);
		const handler = createCallHandler();

		interceptor.intercept(ctx, handler).subscribe();

		expect(service.getLocale()).toBe('en');
	});

	it('should set locale when extracted locale is valid (covers lines 54-58)', () => {
		const { interceptor, service } = createTestInterceptor();
		service.setLocale('en');
		const request: any = {
			query: { locale: 'ru' },
			headers: {},
			cookies: {},
			params: {},
		};
		const ctx = createExecutionContext(request);
		const handler = createCallHandler();

		interceptor.intercept(ctx, handler).subscribe();

		// This covers lines 54-58: if (locale) { ... if (locale in locales) { setLocale } }
		expect(service.getLocale()).toBe('ru');
	});

	it('should not set locale when extracted locale is undefined (covers line 54)', () => {
		const { interceptor, service } = createTestInterceptor();
		service.setLocale('en');
		const request: any = {
			headers: {},
			query: {},
			cookies: {},
			params: {},
		};
		const ctx = createExecutionContext(request);
		const handler = createCallHandler();

		interceptor.intercept(ctx, handler).subscribe();

		// This covers line 54: if (locale) - when locale is undefined, the block is skipped
		expect(service.getLocale()).toBe('en');
	});

	it('should call next handler', async () => {
		const { interceptor } = createTestInterceptor();
		const request: any = {
			headers: {},
			query: {},
			cookies: {},
			params: {},
		};
		const ctx = createExecutionContext(request);
		const handler = createCallHandler();
		const handleSpy = vi.spyOn(handler, 'handle');

		await new Promise<void>((resolve) => {
			interceptor.intercept(ctx, handler).subscribe({
				complete: () => {
					expect(handleSpy).toHaveBeenCalled();
					resolve();
				},
			});
		});
	});
});
