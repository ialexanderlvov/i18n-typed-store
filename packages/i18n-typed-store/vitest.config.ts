import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			include: ['src/**/*.ts'],
			exclude: ['src/**/*.d.ts', 'src/**/index.ts', 'src/types/**/*.ts'],
			thresholds: {
				statements: 97,
				branches: 93,
				functions: 97,
				lines: 97,
			},
		},
	},
});
