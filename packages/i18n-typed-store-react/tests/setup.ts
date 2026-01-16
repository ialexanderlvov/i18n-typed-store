import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
// Cleanup after each test
afterEach(() => {
	cleanup();
});
