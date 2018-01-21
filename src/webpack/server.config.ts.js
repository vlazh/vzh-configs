import webpackMerge from 'webpack-merge';
import paths from '../paths';
import reactEnv from '../reactEnv';
import serverConfig from './server.config';
import loaders from './loaders';

export const defaultRules = {
  tsRule: {
    test: /\.tsx?$/,
    include: [paths.server.sources, paths.shared.sources],
  },
};

export default ({ entry, rules, tsconfigPath = path.join(paths.server.root, 'tsconfig.json') }) => {
  const { tsRule, ...rest } = defaultRules;

  const useDefaultRules = {
    tsRule: {
      ...tsRule,
      use: loaders.ts({
        tsconfig: tsconfigPath,
        forkedChecks: true,
        afterLoaders: reactEnv.prod
          ? []
          : [
              {
                // Necessary for RHL4.
                // Not working with RHL3 and DateRangePicker.
                loader: 'babel-loader',
              },
            ],
      }),
    },
    ...rest,
  };

  // Merge and replace rules
  const moduleRules = webpackMerge.strategy(
    Object.getOwnPropertyNames(useDefaultRules).reduce(
      (obj, name) => ({
        ...obj,
        [name]: 'replace',
      }),
      {}
    )
  )(useDefaultRules, rules);

  return webpackMerge(serverConfig({ entry, rules: moduleRules }), {
    plugins: [loaders.tsCheckerPlugin({ tsconfig: tsconfigPath })],
  });
};
