import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { I18nService } from './i18n.service';

/**
 * Helper function to get I18nService from request object
 *
 * The service is attached to the request by I18nInterceptor or I18nMiddleware.
 * This is a common pattern in NestJS for parameter decorators (used by @nestjs/passport),
 * where services need to be accessed in decorators that run during request processing.
 *
 * Alternative approach: Inject I18nService directly in controller constructor instead of using decorators.
 *
 * @internal Exported for testing purposes only
 */
export function getI18nService(ctx: ExecutionContext): I18nService {
	const request = ctx.switchToHttp().getRequest();
	const i18nService = request?.i18nService;

	if (!i18nService) {
		throw new Error(
			'I18nService is not available. Make sure I18nModule is imported and I18nInterceptor or I18nMiddleware is configured. Alternatively, inject I18nService directly in your controller constructor.',
		);
	}

	return i18nService;
}

/**
 * Decorator for getting internationalization service in controllers/services
 *
 * Gets the service from request object (attached by I18nInterceptor or I18nMiddleware).
 *
 * @example
 * ```ts
 * @Get()
 * async getData(@I18n() i18n: I18nService) {
 *   const translation = i18n.getTranslation('common');
 *   return translation?.greeting;
 * }
 * ```
 */
export const I18n = createParamDecorator((_: unknown, ctx: ExecutionContext): I18nService => {
	return getI18nService(ctx);
});

/**
 * Decorator for getting current locale
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
	const i18nService = getI18nService(ctx);
	return String(i18nService.getLocale());
});

/**
 * Decorator for getting translation for the specified namespace
 *
 * @param namespace - Namespace key
 *
 * @example
 * ```ts
 * @Get()
 * async getData(@Translation('common') translation: CommonTranslation) {
 *   return translation.greeting;
 * }
 * ```
 */
export const Translation = (namespace: string) =>
	createParamDecorator((_: unknown, ctx: ExecutionContext) => {
		const i18nService = getI18nService(ctx);
		return i18nService.getTranslation(namespace);
	})(namespace);
