/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config, { dev }) {
    if (dev) {
      // Windows NTFS is case-insensitive but case-preserving.
      // webpack's filesystem cache compares paths as strings, so it sees
      // "Desktop" and "desktop" as different modules for the same file.
      // Switching to an in-memory cache avoids the path-string comparison
      // entirely and eliminates the "multiple modules differing only in casing"
      // warnings in dev mode.
      config.cache = { type: 'memory' };
    }
    return config;
  },
};

export default nextConfig;
