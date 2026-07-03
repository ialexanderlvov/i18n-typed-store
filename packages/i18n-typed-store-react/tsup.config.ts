import { defineConfig } from 'tsup';
import { readFile, writeFile } from 'node:fs/promises';

// Every export of the main entry is a client-only React construct (Context,
// hooks). Without a "use client" directive the bundle crashes in the Next.js
// App Router / React Server Components, where modules are server components
// by default.
//
// A tsup/esbuild `banner` does NOT work here: esbuild treats a top-level
// "use client" string as a module directive and strips it when bundling
// ("Module level directives cause errors when bundled ... was ignored").
// So we prepend it to the emitted files after the build instead. It is added
// before any existing directive; because it stays inside the directive
// prologue, a following 'use strict' (CJS) still applies.
//
// The directive is applied ONLY to the index outputs: the `server` entry
// exists precisely so that the SSR utilities stay importable from Server
// Components / getServerSideProps, where "use client" would forbid it.
const CLIENT_DIRECTIVE = '"use client";\n';
const CLIENT_OUTPUTS = ['dist/index.js', 'dist/index.mjs'];

export default defineConfig({
	entry: ['src/index.ts', 'src/server.ts'],
	splitting: false,
	sourcemap: true,
	clean: true,
	dts: true,
	treeshake: true,
	format: ['cjs', 'esm'],
	async onSuccess() {
		await Promise.all(
			CLIENT_OUTPUTS.map(async (file) => {
				const content = await readFile(file, 'utf8');
				if (!content.startsWith('"use client"') && !content.startsWith("'use client'")) {
					await writeFile(file, CLIENT_DIRECTIVE + content);
				}
			}),
		);
	},
});
