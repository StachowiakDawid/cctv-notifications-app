// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

// allow .cjs imports
config.resolver.sourceExts.push('cjs');
// <-- this line is the key fix
config.resolver.unstable_enablePackageExports = false;

module.exports = config;