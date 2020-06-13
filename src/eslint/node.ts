import fs from 'fs';
import path from 'path';
import apprc from '../apprc';
import paths, { moduleExtensions } from '../paths';
import { eslintTsProject } from './consts';

const config: import('eslint').Linter.Config = {
  extends: [require.resolve('./common')],

  env: {
    node: true,
  },

  settings: {
    'import/resolver': {
      ...(apprc.server.webpackConfig
        ? { webpack: { config: apprc.server.webpackConfig } }
        : undefined),
    },
  },

  overrides: [
    {
      files: moduleExtensions.filter((ext) => ext.includes('ts')).map((ext) => `*${ext}`),

      parserOptions: {
        project: (() => {
          if (fs.existsSync(path.join(paths.server.root, eslintTsProject)))
            return path.join(paths.server.root, eslintTsProject);
          if (fs.existsSync(paths.server.tsconfig)) return paths.server.tsconfig;
          return fs.existsSync(eslintTsProject) ? eslintTsProject : 'tsconfig.json';
        })(),
      },
    },
  ],
};

module.exports = config;