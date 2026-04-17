import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { I18nService } from './i18n.service';
import { extractLocaleFromContext } from './utils';
import { I18N_SERVICE, I18N_OPTIONS } from './tokens';
import { I18nModuleOptions, I18nRequestContext } from '../types/types';
import { i18nRequestStorage } from './request-context';

// Types for Express (if installed)
type ExpressRequest = {
	headers: Record<string, string | string[] | undefined>;
	cookies?: Record<string, string | undefined>;
	query?: Record<string, string | string[] | undefined>;
	params?: Record<string, string | undefined>;
	[key: string]: any;
};

type ExpressResponse = {
	[key: string]: any;
};

type ExpressNextFunction = () => void;

/**
 * Middleware for binding the request locale to AsyncLocalStorage so that
 * `I18nService` (and any code that calls into it during the request) sees a
 * per-request locale rather than racing on the singleton's `currentLocale`.
 *
 * Prefer this over `I18nInterceptor` when you need locale availability inside
 * exception filters, validation pipes, or guards — those run before
 * interceptors complete.
 */
@Injectable()
export class I18nMiddleware implements NestMiddleware {
	constructor(
		@Inject(I18N_SERVICE)
		private readonly i18nService: I18nService,
		@Inject(I18N_OPTIONS)
		private readonly options: I18nModuleOptions,
	) {}

	use(req: ExpressRequest, _: ExpressResponse, next: ExpressNextFunction) {
		// Attach service to request for parameter decorators that prefer
		// reading from `req.i18nService` over injecting the service directly.
		Object.defineProperty(req, 'i18nService', {
			value: this.i18nService,
			writable: false,
			enumerable: false,
			configurable: false,
		});

		const requestContext: I18nRequestContext = {
			headers: req.headers,
			cookies: req.cookies,
			query: req.query,
			params: req.params,
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

		// Run downstream handlers inside the per-request scope so that any
		// async work they trigger sees the same locale.
		i18nRequestStorage.run({ locale: resolvedLocale }, () => next());
	}
}
