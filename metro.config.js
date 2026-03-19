const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(
  /** @type {import('metro-config').MetroConfig} */ (config),
  /** @type {any} */ ({
    input: './global.css',
  }),
);
