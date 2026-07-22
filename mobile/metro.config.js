// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// zustand's ESM (.mjs) build uses `import.meta.env`, which SDK-54 Metro doesn't transform
// for its classic-script output (breaks web AND native). Disabling package `exports`
// resolution makes Metro use the CommonJS builds (no import.meta).
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
