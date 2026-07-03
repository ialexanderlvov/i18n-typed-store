/**
 * Parsed BCP 47 locale tag structure.
 * Format: language[-script][-region][-variant]
 */
export interface ParsedLocale {
	/** Language code (e.g., 'ru', 'en') */
	language: string;
	/** Script code (e.g., 'Latn', 'Cyrl', 'Hans') */
	script?: string;
	/** Region code (e.g., 'RU', 'US', 'CN') */
	region?: string;
	/** Variant code (optional) */
	variant?: string;
	/** Original locale string */
	original: string;
}

/**
 * Parses a BCP 47 locale tag into its components.
 * Supports formats: language[-script][-region][-variant]
 *
 * @param locale - Locale string to parse (e.g., 'ru-RU', 'en-US', 'zh-Hans-CN')
 * @returns Parsed locale object
 *
 * @example
 * ```ts
 * parseLocale('ru-RU') // { language: 'ru', region: 'RU', original: 'ru-RU' }
 * parseLocale('zh-Hans-CN') // { language: 'zh', script: 'Hans', region: 'CN', original: 'zh-Hans-CN' }
 * parseLocale('en') // { language: 'en', original: 'en' }
 * ```
 */
export function parseLocale(locale: string): ParsedLocale {
	const parts = locale.split('-');
	const result: ParsedLocale = {
		language: parts[0]?.toLowerCase() || '',
		original: locale,
	};

	if (parts.length === 1) {
		return result;
	}

	// Check if second part is a script (usually 4 characters) or region (usually 2-3 characters)
	// Scripts are typically 4 characters (e.g., 'Latn', 'Cyrl', 'Hans')
	// Regions are typically 2-3 characters (e.g., 'RU', 'US', 'CN', 'GB')
	if (parts[1] && parts[1].length === 4 && /^[A-Za-z]{4}$/.test(parts[1])) {
		// It's a script
		result.script = parts[1];
		if (parts[2]) {
			// Third part is region
			result.region = parts[2].toUpperCase();
			if (parts[3]) {
				result.variant = parts[3];
			}
		}
	} else if (parts[1] && (/^[A-Za-z]{2}$/.test(parts[1]) || /^[0-9]{3}$/.test(parts[1]))) {
		// It's a region: BCP 47 regions are exactly 2 letters (ISO 3166-1
		// alpha-2, e.g. 'RU') or 3 digits (UN M.49, e.g. '419'). A 3-letter
		// subtag like the one in 'en-abc' is NOT a region and falls through
		// to the variant branch below.
		result.region = parts[1].toUpperCase();
		if (parts[2]) {
			result.variant = parts[2];
		}
	} else if (parts[1]) {
		// Unknown format, treat as variant
		result.variant = parts[1];
	}

	return result;
}

/**
 * Generates locale fallback candidates in order of preference.
 * Returns array of possible locale matches from most specific to least specific.
 *
 * @param locale - Locale string to generate candidates for
 * @returns Array of locale candidates in order of preference
 *
 * @example
 * ```ts
 * generateLocaleCandidates('ru-RU')
 * // Returns: ['ru-RU', 'ru']
 *
 * generateLocaleCandidates('zh-Hans-CN')
 * // Returns: ['zh-Hans-CN', 'zh-Hans', 'zh-CN', 'zh']
 * ```
 */
export function generateLocaleCandidates(locale: string): string[] {
	const parsed = parseLocale(locale);
	const candidates: string[] = [];

	// 1. Exact match (original)
	candidates.push(parsed.original);

	// 2. Without variant
	if (parsed.variant) {
		const withoutVariant = parsed.script
			? `${parsed.language}-${parsed.script}${parsed.region ? `-${parsed.region}` : ''}`
			: parsed.region
				? `${parsed.language}-${parsed.region}`
				: parsed.language;
		if (withoutVariant !== parsed.original) {
			candidates.push(withoutVariant);
		}
	}

	// 3. Without region (keep script if exists)
	if (parsed.region) {
		const withoutRegion = parsed.script ? `${parsed.language}-${parsed.script}` : parsed.language;
		if (withoutRegion !== parsed.original && !candidates.includes(withoutRegion)) {
			candidates.push(withoutRegion);
		}
	}

	// 4. Without script (keep region if exists)
	if (parsed.script) {
		const withoutScript = parsed.region ? `${parsed.language}-${parsed.region}` : parsed.language;
		if (withoutScript !== parsed.original && !candidates.includes(withoutScript)) {
			candidates.push(withoutScript);
		}
	}

	// 5. Language only (if not already added)
	if (!candidates.includes(parsed.language)) {
		candidates.push(parsed.language);
	}

	return candidates;
}

/**
 * Finds the best matching locale from available locales using BCP 47 locale matching rules.
 * Tries to find the closest match by progressively removing parts (variant -> region -> script -> language).
 *
 * @param requestedLocale - Locale string requested by user (e.g., 'ru-RU', 'en-US')
 * @param availableLocales - Object or array of available locale keys
 * @returns Best matching locale key or null if no match found
 *
 * @example
 * ```ts
 * const locales = { 'ru': 'ru', 'en': 'en', 'ru-RU': 'ru-RU' } as const;
 * findBestMatch('ru-RU', locales) // Returns 'ru-RU'
 * findBestMatch('ru-BY', locales) // Returns 'ru' (fallback to language)
 * findBestMatch('en-GB', locales) // Returns 'en' (fallback to language)
 * ```
 */
export function findBestLocaleMatch<T extends Record<string, string>>(requestedLocale: string, availableLocales: T): keyof T | null;
export function findBestLocaleMatch(requestedLocale: string, availableLocales: string[]): string | null;
export function findBestLocaleMatch(requestedLocale: string, availableLocales: Record<string, string> | string[]): string | null {
	// Normalize requested locale
	const normalizedRequested = requestedLocale.toLowerCase();

	// Get available locale keys
	const availableKeys = Array.isArray(availableLocales) ? availableLocales : Object.keys(availableLocales);

	// Parse every available key once up front. findBestLocaleMatch sits on the
	// hot path (changeLocale / store.load); the previous implementation
	// re-parsed every key via parseLocale inside multiple .filter()/.find()
	// passes per candidate — O(candidates * keys) parse+regex+allocation calls.
	// Insertion order is preserved, so match selection is byte-for-byte unchanged.
	const parsedKeys = availableKeys.map((key) => {
		const lower = key.toLowerCase();
		return { key, lower, parsed: parseLocale(lower) };
	});

	// Generate candidates in order of preference
	const candidates = generateLocaleCandidates(normalizedRequested);

	// Try exact match first (case-insensitive)
	for (const candidate of candidates) {
		const candidateLower = candidate.toLowerCase();
		const exactMatch = parsedKeys.find((entry) => entry.lower === candidateLower);
		if (exactMatch) {
			return exactMatch.key;
		}
	}

	// Try partial matches - for each candidate, find best matching available locale
	for (const candidate of candidates) {
		const parsedCandidate = parseLocale(candidate);

		// Find all locales with matching language
		const languageMatches = parsedKeys.filter((entry) => entry.parsed.language === parsedCandidate.language);

		if (languageMatches.length === 0) {
			continue;
		}

		// If candidate has script, prefer locales with matching script
		if (parsedCandidate.script) {
			const scriptMatches = languageMatches.filter((entry) => entry.parsed.script === parsedCandidate.script);

			if (scriptMatches.length > 0) {
				// If candidate has region, prefer locales with matching region
				if (parsedCandidate.region) {
					const regionMatches = scriptMatches.filter((entry) => entry.parsed.region === parsedCandidate.region);

					if (regionMatches.length > 0) {
						return regionMatches[0].key;
					}
				}

				// Return first script match
				return scriptMatches[0].key;
			}

			// If script is specified but doesn't match, skip this candidate
			// and try next candidate (which will be without script)
			continue;
		}

		// If candidate has region (but no script or script didn't match), prefer locales with matching region
		if (parsedCandidate.region) {
			const regionMatches = languageMatches.filter((entry) => entry.parsed.region === parsedCandidate.region);

			if (regionMatches.length > 0) {
				return regionMatches[0].key;
			}
		}

		// Return first language match without script as fallback (prefer simpler locales)
		// Filter out locales with scripts to prefer base language
		const simpleMatches = languageMatches.filter((entry) => !entry.parsed.script && !entry.parsed.region);

		if (simpleMatches.length > 0) {
			return simpleMatches[0].key;
		}

		// If no simple match, try to find locale without script but with region
		const languageOnlyMatches = languageMatches.filter((entry) => !entry.parsed.script);

		if (languageOnlyMatches.length > 0) {
			return languageOnlyMatches[0].key;
		}

		// If no simple match, return first language match
		return languageMatches[0].key;
	}

	return null;
}
