import { defineConfig } from 'vitest/config';

export default defineConfig({
	// The integration tests declare real Nest controllers/modules with
	// decorators; esbuild only honors `experimentalDecorators` when it is set
	// explicitly (the package tsconfig excludes the tests directory).
	esbuild: {
		tsconfigRaw: {
			compilerOptions: {
				experimentalDecorators: true,
			},
		},
	},
	test: {
		globals: true,
		environment: 'jsdom',
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			include: ['src/**/*.ts', 'src/**/*.tsx'],
			exclude: ['src/**/*.d.ts', 'src/**/index.ts', 'src/types/**/*.ts'],
			thresholds: {
				statements: 94,
				branches: 89,
				functions: 94,
				lines: 94,
			},
		},
	},
});
