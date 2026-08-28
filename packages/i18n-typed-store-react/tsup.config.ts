import { defineConfig } from 'tsup';
import { readFile, writeFile } from 'node:fs/promises';

// The main entry contains client-only React constructs (Context, components,
// hooks). Without a "use client" directive the bundle crashes in the Next.js
// App Router / React Server Components, where modules are server components
// by default. SSR helpers are isolated in the dedicated `server` entry.
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
				const emittedContent = await readFile(file, 'utf8');
				const content =
					emittedContent.startsWith('"use client"') || emittedContent.startsWith("'use client'")
						? emittedContent
						: CLIENT_DIRECTIVE + emittedContent;

				if (file.endsWith('.mjs') && /^export\s+\*\s+from\s+/m.test(content)) {
					throw new Error(
						'The client entry contains a wildcard re-export, which Next.js webpack cannot use as an RSC client boundary.',
					);
				}

				if (content !== emittedContent) {
					await writeFile(file, content);
				}
			}),
		);
	},
});
