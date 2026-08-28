/**
 * Aggregates namespace failures produced while preloading or atomically
 * changing a locale. Individual rejection values are preserved unchanged.
 */
export class LocaleLoadError<
	LocaleKey extends PropertyKey = PropertyKey,
	NamespaceKey extends PropertyKey = PropertyKey,
> extends AggregateError {
	/** Locale whose namespaces failed to load. */
	readonly locale: LocaleKey;
	/** Exact rejection value for every failed namespace. */
	readonly failures: ReadonlyMap<NamespaceKey, unknown>;

	constructor(locale: LocaleKey, failures: ReadonlyMap<NamespaceKey, unknown>) {
		const failureEntries = [...failures.entries()];
		const namespaceList = failureEntries.map(([namespace]) => String(namespace)).join(', ');
		super(
			failureEntries.map(([, error]) => error),
			`Failed to load locale "${String(locale)}" for namespace${failureEntries.length === 1 ? '' : 's'}: ${namespaceList}`,
		);
		this.name = 'LocaleLoadError';
		this.locale = locale;
		this.failures = new Map(failureEntries);
	}
}
