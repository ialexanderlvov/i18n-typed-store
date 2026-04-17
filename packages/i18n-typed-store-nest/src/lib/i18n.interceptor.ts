import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { I18nService } from './i18n.service';
import { extractLocaleFromContext } from './utils';
import { I18N_SERVICE, I18N_OPTIONS } from './tokens';
import { I18nModuleOptions, I18nRequestContext } from '../types/types';

declare module 'express' {
	// Inject additional properties on express.Request
	interface Request {
		i18nService: I18nService;
	}
}

/**
 * Interceptor for automatically detecting and setting locale from request
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
		// Note: While not the ideal NestJS pattern, this is a common approach for
		// parameter decorators (similar to @nestjs/passport). The service is already
		// properly injected via DI in the interceptor, and this allows decorators
		// to access it. Alternative: inject I18nService directly in controllers.
		Object.defineProperty(request, 'i18nService', {
			value: this.i18nService,
			writable: false,
			enumerable: false,
			configurable: false,
		});

		// Create request context for locale extraction
		const requestContext: I18nRequestContext = {
			headers: request.headers as Record<string, string | string[] | undefined>,
			cookies: request.cookies as Record<string, string | undefined>,
			query: request.query as Record<string, string | string[] | undefined>,
			params: request.params as Record<string, string | undefined>,
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

		return next.handle();
	}
}
