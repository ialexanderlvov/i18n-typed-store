import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { I18nService } from './i18n.service';
import { extractLocaleFromContext } from './utils';
import { I18N_SERVICE, I18N_OPTIONS } from './tokens';
import { I18nModuleOptions, I18nRequestContext } from '../types/types';
import { i18nRequestStorage, I18nRequestState } from './request-context';

declare module 'express' {
	// Inject additional properties on express.Request
	interface Request {
		i18nService: I18nService;
	}
}

/**
 * Interceptor that detects the request locale and binds it to
 * AsyncLocalStorage so that `I18nService` (and code it calls) sees a
 * per-request locale instead of racing on the singleton.
 *
 * **Caveat:** interceptors run after guards/pipes, so an exception thrown by
 * a validation pipe will skip this code path. If you need a localized error
 * response from those layers, use `I18nMiddleware` (which runs earlier)
 * instead of — or in addition to — this interceptor.
 */
@Injectable()
export class I18nInterceptor implements NestInterceptor {
	constructor(
		@Inject(I18N_SERVICE)
		private readonly i18nService: I18nService,
		@Inject(I18N_OPTIONS)
		private readonly options: I18nModuleOptions,
	) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const request = context.switchToHttp().getRequest();

		// Attach service to request for use in parameter decorators
		Object.defineProperty(request, 'i18nService', {
			value: this.i18nService,
			writable: false,
			enumerable: false,
			configurable: false,
		});

		const requestContext: I18nRequestContext = {
			headers: request.headers as Record<string, string | string[] | undefined>,
			cookies: request.cookies as Record<string, string | undefined>,
			query: request.query as Record<string, string | string[] | undefined>,
			params: request.params as Record<string, string | undefined>,
		};

		const detectedLocale = extractLocaleFromContext(requestContext, {
			headerName: this.options.headerName,
			queryParamName: this.options.queryParamName,
			cookieName: this.options.cookieName,
			parseAcceptLanguage: this.options.parseAcceptLanguage,
			availableLocales: this.options.availableLocales as readonly string[] | undefined,
			defaultLocale: this.options.defaultLocale as string | undefined,
		});

		const locales = this.i18nService.getLocales();
		const resolvedLocale = detectedLocale && Object.prototype.hasOwnProperty.call(locales, detectedLocale) ? detectedLocale : undefined;

		// If middleware already opened a scope for this request, just update
		// the slot in place — same store keeps async work consistent.
		const existing = i18nRequestStorage.getStore();
		if (existing) {
			existing.locale = resolvedLocale;
			return next.handle();
		}

		// No scope yet (interceptor used standalone). We have to wrap the
		// *subscription* — not just `intercept()` — because rxjs invokes
		// downstream operators when a subscriber attaches, which can be
		// later than this synchronous frame. We bind ALS at subscribe time
		// and rely on Node propagating it through async/await downstream.
		const state: I18nRequestState = { locale: resolvedLocale };
		return new Observable((subscriber) => {
			return i18nRequestStorage.run(state, () => next.handle().subscribe(subscriber));
		});
	}
}
