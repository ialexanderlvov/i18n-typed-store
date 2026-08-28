import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { findBestLocaleMatch } from 'i18n-typed-store';
import { I18nService } from './i18n.service';
import { extractLocaleFromContext, getRequestFromExecutionContext, attachI18nServiceToRequest, buildRequestContext } from './utils';
import { I18N_SERVICE, I18N_OPTIONS } from './tokens';
import { I18nModuleOptions } from '../types/types';
import { i18nRequestStorage, I18nRequestState } from './request-context';

type AnyI18nService = I18nService<any, any, any>;
type AnyI18nModuleOptions = I18nModuleOptions<any, any, any>;

declare module 'express' {
	// Augment express.Request with the property attached by the middleware /
	// interceptor. It is OPTIONAL: it only exists once one of them has run, and
	// declaring it non-optional would falsely promise every consumer that
	// `req.i18nService` is always present (e.g. inside guards that run first).
	interface Request {
		i18nService?: AnyI18nService;
	}
}

/**
 * Interceptor that detects the request locale and binds it to
 * AsyncLocalStorage so that `I18nService` (and code it calls) sees a
 * per-request locale instead of racing on the singleton.
 *
 * Transport support:
 *  - HTTP — full detection (query / route / cookie / header, or the
 *    configured `resolvers` order).
 *  - GraphQL — detection runs against the HTTP request found at
 *    `context.getArgs()[2].req` (no `@nestjs/graphql` dependency). When the
 *    request is absent (e.g. subscriptions) the default locale is used.
 *  - WS / RPC — no HTTP headers exist; the request binds to the default
 *    locale so `I18nService` still behaves deterministically.
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
		private readonly i18nService: AnyI18nService,
		@Inject(I18N_OPTIONS)
		private readonly options: AnyI18nModuleOptions,
	) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const contextType = context.getType<string>();
		// `undefined` on ws/rpc and on GraphQL contexts without an HTTP request.
		const request = getRequestFromExecutionContext(context);

		// Attach service to request for use in parameter decorators. Safe on
		// every transport: no-op for non-object requests, tolerant of an
		// earlier non-configurable define (e.g. middleware already ran).
		attachI18nServiceToRequest(request, this.i18nService);

		// Header/cookie/query detection only makes sense for HTTP-shaped
		// requests (http itself, or GraphQL over HTTP). For ws/rpc the empty
		// context yields no candidates and detection falls back to the
		// configured default locale.
		const isHttpShaped = (contextType === 'http' || contextType === 'graphql') && typeof request === 'object' && request !== null;

		const detectedLocale = extractLocaleFromContext(isHttpShaped ? buildRequestContext(request) : {}, {
			headerName: this.options.headerName,
			queryParamName: this.options.queryParamName,
			cookieName: this.options.cookieName,
			parseAcceptLanguage: this.options.parseAcceptLanguage,
			availableLocales: this.options.availableLocales as readonly string[] | undefined,
			defaultLocale: this.options.defaultLocale as string | undefined,
			resolvers: this.options.resolvers,
			request,
		});

		// Detection returns entries from `availableLocales`, which may be BCP 47
		// tags rather than literal store keys — map to a real store key here.
		const locales = this.i18nService.getLocales();
		const resolvedLocale =
			detectedLocale === undefined ? undefined : ((findBestLocaleMatch(detectedLocale, locales) as string | null) ?? undefined);

		// If middleware already opened a scope for this request, only fill the
		// slot when it is still empty. Guards run BEFORE interceptors and may have
		// already set a more specific per-request locale (e.g. the authenticated
		// user's preferred language) via `setRequestLocale` — unconditionally
		// overwriting it here would clobber that choice on every request.
		const existing = i18nRequestStorage.getStore();
		if (existing) {
			if (existing.locale === undefined && resolvedLocale !== undefined) {
				existing.locale = resolvedLocale;
			}
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
