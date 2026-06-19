import { fileURLToPath } from 'url';
import path from 'path';
import { realpathSync } from 'fs';

// Development-only: this Windows environment cannot verify external TLS certs
// (same root cause as the next/font/google failure). Setting this here ensures
// it is active before Next.js or the OpenAI SDK make any HTTPS calls.
// Has no effect in production — NODE_ENV is 'production' on any real deployment.
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// Canonical project root — realpathSync gives the true on-disk casing.
const canonicalRoot = realpathSync(path.dirname(fileURLToPath(import.meta.url)));
const lowerRoot = canonicalRoot.toLowerCase();

/**
 * On Windows, webpack constructs some module paths programmatically
 * (not from filesystem lookups), which can produce a lowercase variant
 * of the project folder ("desktop" instead of "Desktop"). webpack treats
 * these as distinct modules, so React contexts created in one instance
 * (ActionQueueContext) are invisible to consumers in the other, causing
 * the "Invariant: Missing ActionQueueContext" hydration error.
 *
 * Fix: hook into webpack's NormalModuleFactory at the afterResolve stage
 * and rewrite any path that case-insensitively matches the project root
 * back to the canonical casing before webpack generates its module ID.
 * This guarantees a single module instance per file.
 */
class WindowsPathCasingFix {
  apply(compiler) {
    compiler.hooks.normalModuleFactory.tap('WindowsPathCasingFix', (nmf) => {
      nmf.hooks.afterResolve.tap('WindowsPathCasingFix', (resolveData) => {
        const cd = resolveData.createData;
        if (!cd) return;

        const fix = (p) => {
          if (!p || typeof p !== 'string') return p;
          if (p.toLowerCase().startsWith(lowerRoot)) {
            return canonicalRoot + p.slice(canonicalRoot.length);
          }
          return p;
        };

        cd.resource        = fix(cd.resource);
        cd.context         = fix(cd.context);
        cd.userRequest     = fix(cd.userRequest);
        cd.request         = fix(cd.request);
      });
    });
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ['llamaindex', 'openai', 'pdf-parse'],
  },
  webpack(config, { dev }) {
    if (dev) {
      config.cache = { type: 'memory' };
    }

    config.resolve.modules = [
      path.resolve(canonicalRoot, 'node_modules'),
      'node_modules',
    ];

    config.plugins = [...(config.plugins ?? []), new WindowsPathCasingFix()];

    return config;
  },
};

export default nextConfig;
