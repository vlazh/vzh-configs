import webpackMerge from 'webpack-merge';
import path from 'path';
import paths from '../paths';
import universalConfig from './universal.config';
import loaders from './loaders';

export default entry =>
  webpackMerge(universalConfig(entry), {
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          include: [paths.server.sources, paths.client.sources, paths.shared.root],
          use: loaders.ts({
            tsconfig: path.join(paths.root, 'tsconfig.json'),
            forkedChecks: true,
          }),
        },
      ],
    },

    plugins: [loaders.tsCheckerPlugin({ tsconfig: path.join(paths.root, 'tsconfig.json') })],
  });
