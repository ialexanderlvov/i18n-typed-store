const SUSPENSE_LOAD_RECORD_TTL_MS = 30_000;

export interface SuspenseLoadRecord {
	status: 'pending' | 'success';
	translation: unknown;
	cleanupScheduled: boolean;
	expiresAt: number | undefined;
	expiryTimer: ReturnType<typeof setTimeout> | undefined;
	owner: SuspenseLoadOwner | undefined;
	localeState: object;
}

export interface SuspenseLoadOwner {
	readonly records: Set<SuspenseLoadRecord>;
	lifecycleVersion: number;
	mountCount: number;
}

/** Internal context key that associates Suspense records with one Provider lifecycle. */
export const suspenseLoadOwnerKey: unique symbol = Symbol('i18n-typed-store-react.suspense-load-owner');

const suspenseLoadRecords = new WeakMap<object, Map<SuspenseLoadOwner | undefined, SuspenseLoadRecord>>();
const pendingSuspenseLoadOwners = new WeakMap<object, SuspenseLoadOwner>();

/**
 * Reuses an owner while a Provider is still inside an uncommitted Suspense
 * tree. React may discard all hook state from that initial render, so a plain
 * useMemo/useRef owner would not survive the retry. React exposes no stable
 * pre-commit Provider identity, so an immediate remount on the same store is
 * deliberately coalesced with that completed cold request. Successful claims
 * are bounded by `SUSPENSE_LOAD_RECORD_TTL_MS` if no Provider ever commits.
 */
export const getOrCreateSuspenseLoadOwner = (scope: object): SuspenseLoadOwner => {
	const pendingOwner = pendingSuspenseLoadOwners.get(scope);
	if (pendingOwner) return pendingOwner;

	const owner: SuspenseLoadOwner = {
		records: new Set(),
		lifecycleVersion: 0,
		mountCount: 0,
	};
	pendingSuspenseLoadOwners.set(scope, owner);
	return owner;
};

/** Marks one Provider using this owner as committed and mounted. */
export const mountSuspenseLoadOwner = (scope: object, owner: SuspenseLoadOwner): void => {
	owner.mountCount += 1;
	owner.lifecycleVersion += 1;
	if (pendingSuspenseLoadOwners.get(scope) === owner) {
		pendingSuspenseLoadOwners.delete(scope);
	}
};

const clearExpiryTimer = (record: SuspenseLoadRecord) => {
	if (record.expiryTimer !== undefined) {
		clearTimeout(record.expiryTimer);
		record.expiryTimer = undefined;
	}
};

export const deleteSuspenseLoadRecord = (localeState: object, record: SuspenseLoadRecord): void => {
	const recordsByOwner = suspenseLoadRecords.get(localeState);
	if (recordsByOwner?.get(record.owner) !== record) return;
	clearExpiryTimer(record);
	recordsByOwner.delete(record.owner);
	if (recordsByOwner.size === 0) suspenseLoadRecords.delete(localeState);
	record.owner?.records.delete(record);
};

export const getSuspenseLoadRecord = (localeState: object, owner?: SuspenseLoadOwner): SuspenseLoadRecord | undefined => {
	const record = suspenseLoadRecords.get(localeState)?.get(owner);
	if (record?.expiresAt !== undefined && record.expiresAt <= Date.now()) {
		deleteSuspenseLoadRecord(localeState, record);
		return undefined;
	}
	return record;
};

export const replaceSuspenseLoadRecord = (localeState: object, owner?: SuspenseLoadOwner): SuspenseLoadRecord => {
	let recordsByOwner = suspenseLoadRecords.get(localeState);
	const previous = recordsByOwner?.get(owner);
	if (previous) deleteSuspenseLoadRecord(localeState, previous);
	if (!recordsByOwner || recordsByOwner.size === 0) {
		recordsByOwner = new Map();
		suspenseLoadRecords.set(localeState, recordsByOwner);
	}

	const record: SuspenseLoadRecord = {
		status: 'pending',
		translation: undefined,
		cleanupScheduled: false,
		expiresAt: undefined,
		expiryTimer: undefined,
		owner,
		localeState,
	};
	recordsByOwner.set(owner, record);
	owner?.records.add(record);
	return record;
};

/**
 * Bounds a successful record even if its suspended render never commits.
 * The timer is unref'ed in Node so an SSR-only marker cannot keep the process alive.
 */
export const markSuspenseLoadRecordSuccessful = (localeState: object, record: SuspenseLoadRecord, translation: unknown): void => {
	if (suspenseLoadRecords.get(localeState)?.get(record.owner) !== record) return;
	record.status = 'success';
	record.translation = translation;
	record.expiresAt = Date.now() + SUSPENSE_LOAD_RECORD_TTL_MS;
	const expiryTimer = setTimeout(() => {
		deleteSuspenseLoadRecord(localeState, record);
	}, SUSPENSE_LOAD_RECORD_TTL_MS);
	record.expiryTimer = expiryTimer;

	const nodeTimer = expiryTimer as ReturnType<typeof setTimeout> & { unref?: () => void };
	nodeTimer.unref?.();
};

/**
 * Keeps the marker alive through every subscription installed in the same
 * commit, then removes it before later, unrelated mounts can consume it.
 */
export const scheduleCommittedSuspenseRecordCleanup = (localeState: object, record: SuspenseLoadRecord): void => {
	if (record.cleanupScheduled) return;
	record.cleanupScheduled = true;
	queueMicrotask(() => {
		deleteSuspenseLoadRecord(localeState, record);
	});
};

/** Clears every pending/successful record owned by a Provider that was really unmounted. */
export const clearSuspenseLoadOwner = (owner: SuspenseLoadOwner): void => {
	for (const record of [...owner.records]) {
		deleteSuspenseLoadRecord(record.localeState, record);
	}
};

/**
 * Releases one committed Provider. Strict Mode's immediate setup replay bumps
 * the version/count before the deferred check and therefore keeps records.
 */
export const releaseSuspenseLoadOwner = (owner: SuspenseLoadOwner): void => {
	owner.mountCount = Math.max(0, owner.mountCount - 1);
	const cleanupVersion = ++owner.lifecycleVersion;
	queueMicrotask(() => {
		if (owner.mountCount === 0 && owner.lifecycleVersion === cleanupVersion) {
			clearSuspenseLoadOwner(owner);
		}
	});
};
