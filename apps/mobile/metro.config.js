const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '../..')];
// Shared source modules use this app's React/native dependencies.
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
module.exports = config;
