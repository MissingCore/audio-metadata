const { getDefaultConfig } = require('@expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const defaultConfig = getDefaultConfig(projectRoot);

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  ...defaultConfig,

  projectRoot,
  // #1 - Watch all files in the monorepo
  watchFolders: [workspaceRoot],

  resolver: {
    ...defaultConfig.resolver,

    // #2 - Try resolving with project modules first, then workspace modules
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
  },
};

module.exports = config;
