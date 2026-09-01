const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration for React Native
 * https://facebook.github.io/metro/docs/configuration
 */
const config = {
  watchFolders: [__dirname],
  projectRoot: __dirname,
  resolver: {
    blacklistRE: /node_modules\/.*\/node_modules/,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
