import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { I18nService } from './i18n.service';
import { extractLocaleFromContext } from './utils';
import { I18N_SERVICE, I18N_OPTIONS } from './tokens';
import { I18nModuleOptions, I18nRequestContext } from '../types/types';

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
 * Middleware for setting internationalization service in request
 * and detecting locale from request
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
		// Attach service to request for use in parameter decorators
		// Note: While not the ideal NestJS pattern, this is a common approach for
		// parameter decorators (similar to @nestjs/passport). The service is already
		// properly injected via DI in the middleware, and this allows decorators
		// to access it. Alternative: inject I18nService directly in controllers.
		Object.defineProperty(req, 'i18nService', {
			value: this.i18nService,
			writable: false,
			enumerable: false,
			configurable: false,
		});

		// Create request context for locale extraction
		const requestContext: I18nRequestContext = {
			headers: req.headers,
			cookies: req.cookies,
			query: req.query,
			params: req.params,
		};

		// Extract locale from request
		const locale = extractLocaleFromContext(requestContext, {
			headerName: this.options.headerName,
			queryParamName: this.options.queryParamName,
			cookieName: this.options.cookieName,
			parseAcceptLanguage: this.options.parseAcceptLanguage,
			availableLocales: this.options.availableLocales as readonly string[] | undefined,
			defaultLocale: this.options.defaultLocale as string | undefined,
		});

		// Set locale in service if it is defined
		if (locale) {
			const locales = this.i18nService.getLocales();
			if (locale in locales) {
				this.i18nService.setLocale(locale as keyof typeof locales);
			}
		}

		next();
	}
}
