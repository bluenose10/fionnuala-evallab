import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config, { dev }) {
    // Windows NTFS is case-insensitive but case-preserving. Node.js internals
    // can resolve the project root as either "Desktop" or "desktop", causing
    // webpack to treat the same file as two separate module instances. React
    // contexts created in one instance (e.g. ActionQueueContext) are invisible
    // to components that imported from the other, producing hydration errors.
    //
    // Fix: pin resolve.modules to the canonical absolute path derived from
    // import.meta.url (which always reflects the real on-disk casing), so
    // every module lookup goes through a single path string.
    config.resolve.modules = [
      path.resolve(__dirname, 'node_modules'),
      'node_modules',
    ];

    if (dev) {
      config.cache = { type: 'memory' };
    }

    return config;
  },
};

export default nextConfig;
