// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// zustand's ESM (.mjs) build uses `import.meta.env`, which SDK-54 Metro doesn't transform
// for its classic-script output (breaks web AND native). Disabling package `exports`
// resolution makes Metro use the CommonJS builds (no import.meta).
config.resolver.unstable_enablePackageExports = false;

// …but posthog-react-native imports `@posthog/core/surveys`, a package-`exports`
// subpath that Metro can't map while exports are disabled. Redirect that one
// specifier to its real built file so the default resolver handles it.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@posthog/core/surveys') {
    moduleName = '@posthog/core/dist/surveys/index.js';
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
