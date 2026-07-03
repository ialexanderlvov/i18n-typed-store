import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { findBestLocaleMatch } from 'i18n-typed-store';
import { I18nService } from './i18n.service';
import { extractLocaleFromContext, attachI18nServiceToRequest, buildRequestContext } from './utils';
import { I18N_SERVICE, I18N_OPTIONS } from './tokens';
import { I18nModuleOptions } from '../types/types';
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
		// Tolerates repeated attachment (e.g. the interceptor also runs).
		attachI18nServiceToRequest(req, this.i18nService);

		const detectedLocale = extractLocaleFromContext(buildRequestContext(req), {
			headerName: this.options.headerName,
			queryParamName: this.options.queryParamName,
			cookieName: this.options.cookieName,
			parseAcceptLanguage: this.options.parseAcceptLanguage,
			availableLocales: this.options.availableLocales as readonly string[] | undefined,
			defaultLocale: this.options.defaultLocale as string | undefined,
			resolvers: this.options.resolvers,
			request: req,
		});

		// Detection returns entries from `availableLocales`, which may be BCP 47
		// tags rather than literal store keys — map to a real store key here.
		const locales = this.i18nService.getLocales();
		const resolvedLocale =
			detectedLocale === undefined ? undefined : ((findBestLocaleMatch(detectedLocale, locales) as string | null) ?? undefined);

		// Run downstream handlers inside the per-request scope so that any
		// async work they trigger sees the same locale.
		i18nRequestStorage.run({ locale: resolvedLocale }, () => next());
	}
}
