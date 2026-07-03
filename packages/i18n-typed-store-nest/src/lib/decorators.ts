import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { I18nService } from './i18n.service';
import { getRequestLocale } from './request-context';
import { getRequestFromExecutionContext } from './utils';

/**
 * Resolves the active `I18nService`.
 *
 * Tries `request.i18nService` first (attached by `I18nMiddleware` /
 * `I18nInterceptor`); the request is extracted transport-agnostically (HTTP,
 * GraphQL args, undefined for ws/rpc). Falls back to throwing a descriptive
 * error so the caller knows to wire up the module.
 *
 * @internal Exported for testing purposes only.
 */
export function getI18nService(ctx: ExecutionContext): I18nService {
	const request = getRequestFromExecutionContext(ctx) as { i18nService?: I18nService } | undefined;
	const i18nService = request?.i18nService;

	if (!i18nService) {
		throw new Error(
			'I18nService is not available. Make sure I18nModule is imported and I18nInterceptor or I18nMiddleware is configured. Alternatively, inject I18nService directly in your controller constructor.',
		);
	}

	return i18nService;
}

/**
 * Decorator for getting internationalization service in controllers/services.
 *
 * @example
 * ```ts
 * @Get()
 * async getData(@I18n() i18n: I18nService) {
 *   return i18n.getTranslationByKey('common.greeting');
 * }
 * ```
 */
export const I18n = createParamDecorator((_: unknown, ctx: ExecutionContext): I18nService => {
	return getI18nService(ctx);
});

/**
 * Decorator for getting the locale resolved for the current request.
 *
 * Reads the per-request locale (set by middleware/interceptor) so it stays
 * correct under concurrent requests. Falls back to the service's current
 * locale when no request-scoped locale is bound.
 *
 * @example
 * ```ts
 * @Get()
 * async getData(@Locale() locale: string) {
 *   return { locale };
 * }
 * ```
 */
export const Locale = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
	const requestLocale = getRequestLocale();
	if (requestLocale) {
		return requestLocale;
	}
	const i18nService = getI18nService(ctx);
	return String(i18nService.getLocale());
});

/**
 * Alias of {@link Locale} for developers migrating from `nestjs-i18n`, where
 * the equivalent decorator is named `@I18nLang()`.
 */
export const I18nLang = Locale;

/**
 * Resolves the translation for the `@Translation()` decorator.
 *
 * Swallows load failures and returns `undefined` instead of rejecting:
 * a rejected param-decorator promise would turn EVERY request to the route
 * into a 500 even though `I18nService.getTranslation` documents `undefined`
 * as its failure contract. Handlers should treat the parameter as optional.
 *
 * @internal Exported for testing purposes only.
 */
export async function resolveTranslationParam(namespace: string, ctx: ExecutionContext): Promise<unknown> {
	const i18nService = getI18nService(ctx);
	try {
		return await i18nService.getTranslation(namespace);
	} catch {
		// Defensive: getTranslation already resolves to undefined on load
		// failure, but a custom I18nService subclass may still throw.
		return undefined;
	}
}

/**
 * Decorator for getting translation for the specified namespace.
 *
 * The decorator returns a Promise that Nest will await before invoking the
 * route handler, so the parameter receives the resolved translation object.
 * Uses the per-request locale automatically. If the translation fails to
 * load, the parameter is `undefined` (the route is NOT failed with a 500).
 *
 * @param namespace - Namespace key
 *
 * @example
 * ```ts
 * @Get()
 * async getData(@Translation('common') translation: CommonTranslation | undefined) {
 *   return translation?.greeting;
 * }
 * ```
 */
export const Translation = (namespace: string) =>
	createParamDecorator((data: string, ctx: ExecutionContext) => {
		return resolveTranslationParam(data, ctx);
	})(namespace);
