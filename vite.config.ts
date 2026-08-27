import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import path from 'node:path';

/** Repository name, so the Pages build resolves assets under the project path. */
const PAGES_BASE = '/PeopleFlow-AI/';

/**
 * Swaps the Supabase transport for the in-memory demo store.
 *
 * Matching on the resolved absolute path rather than the import specifier is
 * what makes this safe: `services/supabase/*` import it as './client' and
 * main.tsx as './services/supabase/client', and both land here, while nothing
 * else named client.ts is touched.
 */
function demoBackend(): Plugin {
  const real = path.resolve(__dirname, 'src/services/supabase/client.ts');
  const demo = path.resolve(__dirname, 'src/demo/supabaseClient.ts');
  return {
    name: 'flowdesk-demo-backend',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (source.includes('/demo/')) return null; // never redirect the demo module into itself
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resolved) return null;
      return path.resolve(resolved.id.split('?')[0]) === real ? demo : null;
    },
  };
}

/** Adds the demo notice and swaps the title, so index.html stays app-only. */
function demoChrome(): Plugin {
  return {
    name: 'flowdesk-demo-chrome',
    transformIndexHtml(html) {
      return html
        .replace(/<title>[^<]*<\/title>/, '<title>FlowDesk - live demo</title>')
        .replace(
          '</body>',
          `<div id="demo-notice" role="note">
  <strong>Demo build.</strong>
  Seeded data in memory, scripted brief-writing answers, nothing saved.
  Sign in as <code>admin</code> / <code>Admin@123</code>, or as any teammate
  (<code>priya</code>, <code>mei</code>, <code>daniel</code>, <code>arjun</code>,
  <code>sofia</code>, <code>tom</code>) with any password of six characters or more.
  <a href="https://github.com/shubhyansh/PeopleFlow-AI">Source</a>
</div>
<style>
  #demo-notice {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 9999;
    padding: 8px 14px;
    font: 12px/1.5 ui-sans-serif, system-ui, sans-serif;
    color: #cbd5e1; background: rgba(2, 6, 23, .94);
    border-top: 1px solid rgba(45, 226, 212, .35);
    text-align: center;
  }
  #demo-notice strong { color: #2de2d4; }
  #demo-notice code {
    padding: 1px 5px; border-radius: 4px;
    background: rgba(148, 163, 184, .16); color: #e2e8f0;
  }
  #demo-notice a { color: #2de2d4; }
  @media (max-width: 760px) { #demo-notice { font-size: 11px; } }
</style>
</body>`,
        );
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const isDev = command === 'serve';

  /**
   * `npm run build:demo` (vite build --mode demo) produces the published
   * browser demo: no Electron shell, no Supabase project, no API key.
   * Selecting on `mode` rather than an env var keeps the script identical on
   * Windows and on the Linux runner. See src/demo/.
   */
  const isDemo = mode === 'demo';

  const electronPlugin = electron({
    main: {
      entry: 'electron/main.ts',
      vite: {
        build: {
          outDir: 'dist-electron',
          sourcemap: isDev,
          minify: !isDev,
          rollupOptions: {
            external: ['electron', 'groq-sdk', 'dotenv'],
            output: {
              format: 'cjs',
              entryFileNames: '[name].js',
            },
          },
        },
        resolve: {
          alias: {
            '@shared': path.resolve(__dirname, 'shared'),
          },
        },
      },
    },
    preload: {
      input: 'electron/preload.ts',
      vite: {
        build: {
          outDir: 'dist-electron',
          sourcemap: isDev ? 'inline' : false,
          minify: !isDev,
          rollupOptions: {
            external: ['electron'],
            output: {
              format: 'cjs',
              entryFileNames: '[name].js',
            },
          },
        },
        resolve: {
          alias: {
            '@shared': path.resolve(__dirname, 'shared'),
          },
        },
      },
    },
    renderer: {},
  });

  return {
    base: isDemo ? PAGES_BASE : '/',
    plugins: isDemo
      ? [react(), demoBackend(), demoChrome()]
      : [react(), electronPlugin],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@shared': path.resolve(__dirname, 'shared'),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
    },
    build: {
      outDir: isDemo ? 'dist-demo' : 'dist',
      sourcemap: isDev,
      emptyOutDir: true,
    },
    clearScreen: false,
  };
});
