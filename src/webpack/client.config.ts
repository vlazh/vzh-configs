import { Configuration, RuleSetRule, RuleSetUse } from 'webpack';
import path from 'path';
import appEnv from '../appEnv';
import paths from '../paths';
import buildConfig from '../buildConfig';
import commonConfig, { CommonConfigOptions } from './common.config';
import loaders, { TsLoaderType } from './loaders';
import nodeRequire from './nodeRequire';

export const clientDefaultRules: Record<
  'jsRule' | 'tsBaseRule' | 'cssRule' | 'cssNodeModulesRule' | 'assetsRule',
  RuleSetRule
> = {
  jsRule: {
    test: /\.jsx?$/,
    include: [paths.client.sources, paths.shared.sources],
    use: loaders.babel(),
  },
  tsBaseRule: {
    test: /\.tsx?$/,
    include: [paths.client.sources, paths.shared.sources],
  },
  cssRule: {
    test: /\.css$/,
    include: [
      paths.client.sources,
      // Because this packages are require css-modules.
      // And to avoid duplicating css classes when composes process in the same loaders.
      path.join(paths.nodeModules.root, '@vzh/react-components'),
      path.join(paths.nodeModules.root, '@vzh/editors'),
      path.join(paths.nodeModules.root, '@vlazh/react-components'),
      path.join(paths.nodeModules.root, '@vlazh/editors'),
      path.join(paths.nodeModules.root, 'reflexy'),
    ],
    use: loaders.css(),
  },
  cssNodeModulesRule: {
    test: /\.css$/,
    include: [paths.nodeModules.root],
    // because this packages included in cssRule
    exclude: [
      path.join(paths.nodeModules.root, '@vzh/react-components'),
      path.join(paths.nodeModules.root, '@vzh/editors'),
      path.join(paths.nodeModules.root, '@vlazh/react-components'),
      path.join(paths.nodeModules.root, '@vlazh/editors'),
      path.join(paths.nodeModules.root, 'reflexy'),
    ],
    use: loaders.cssNodeModules(),
  },
  assetsRule: {
    test: /\.(png|jpg|gif|svg|eot|ttf|woff|woff2|otf)$/,
    include: [paths.client.assets, paths.nodeModules.root],
    use: loaders.assets(),
  },
};

export interface ClientConfigOptions extends Omit<CommonConfigOptions, 'typescript'> {
  typescript?:
    | (CommonConfigOptions['typescript'] & {
        loaderOptions?: Record<string, any>;
        threadLoader?: boolean;
        threadLoaderOptions?: Record<string, any>;
      })
    | boolean;
  rules?: Record<string, RuleSetRule>;
}

function containsLoader(rules: Record<string, RuleSetRule>, loader: string): boolean {
  const checkRule = (use?: RuleSetUse): boolean => {
    if (typeof use === 'string') return use.includes(loader);
    if (Array.isArray(use)) return use.some(checkRule);
    if (typeof use !== 'function' && use && use.loader) return use.loader.includes(loader);
    return false;
  };

  return Object.getOwnPropertyNames(rules).some((key) => {
    const rule = rules[key];
    return checkRule(rule.loader || rule.loaders || rule.use);
  });
}

export default ({
  outputPath = paths.client.output.path,
  outputPublicPath = buildConfig.client.output.publicPath,
  outputJsDir = buildConfig.client.output.js,
  hash = true,
  typescript,
  entry,
  rules: { tsBaseRule, ...rules } = {},
  ...restOptions
}: ClientConfigOptions): Configuration => {
  const { tsBaseRule: defaultTsBaseRule, ...restRules } = clientDefaultRules;

  const tsConfig: Required<ClientConfigOptions['typescript']> = {
    configFile: paths.client.tsconfig,
    loader: TsLoaderType.Default,
    loaderOptions: {},
    forkedChecks: false,
    checkerOptions: {},
    threadLoader: false,
    threadLoaderOptions: {},
    ...(typeof typescript === 'object' ? typescript : undefined),
  };

  const preparedRules = typescript
    ? {
        tsRule: {
          ...defaultTsBaseRule,
          ...tsBaseRule,
          use: loaders.getTsLoader({
            tsconfig: tsConfig.configFile,
            forkedChecks: tsConfig.forkedChecks,
            useThreadLoader: tsConfig.threadLoader,
            threadLoaderOptions: tsConfig.threadLoaderOptions,
            ...tsConfig.loaderOptions,
            loaderType: tsConfig.loader,
          }),
        },
        ...restRules,
      }
    : { ...restRules };

  const moduleRules = { ...preparedRules, ...rules };

  return commonConfig({
    outputPath,
    outputPublicPath,
    outputJsDir,
    hash,
    typescript: typescript
      ? {
          ...tsConfig,
          checkerOptions: {
            ...tsConfig.checkerOptions,
            typescript: {
              ...tsConfig.checkerOptions.typescript,
              diagnosticsOptions: {
                syntactic: tsConfig.threadLoader, // ts-loader in happyPackMode will not check SyntacticErrors so let check it in this plugin
                ...tsConfig.checkerOptions.typescript?.diagnosticsOptions,
              },
            },
          },
        }
      : undefined,

    name: buildConfig.client.root,
    target: 'web',

    context: paths.client.sources,

    entry,

    // recordsOutputPath: path.join(paths.output.path, 'webpack.client.stats.json'),

    ...restOptions,

    resolve: {
      ...restOptions.resolve,
      modules: [
        paths.client.sources,
        ...((restOptions.resolve && restOptions.resolve.modules) || []),
      ],
      alias: {
        // for universal projects
        shared: paths.shared.sources,
        ...((restOptions.resolve && restOptions.resolve.alias) || undefined),
      },
    },

    module: {
      ...restOptions.module,
      rules: [
        ...Object.getOwnPropertyNames(moduleRules).map((name) => moduleRules[name] || {}),
        // Provide pug loader if html template is pug template
        ...(buildConfig.client.html.template && buildConfig.client.html.template.endsWith('.pug')
          ? [{ test: /\.pug$/, use: { loader: 'pug-loader' } }]
          : []),
        ...((restOptions.module && restOptions.module.rules) || []),
      ],
    },

    plugins: [
      // Generate html if needed
      buildConfig.client.html.template &&
        (() => {
          const { template, ...rest } = buildConfig.client.html;
          const getName = (): string => 'html-webpack-plugin';
          const HtmlWebpackPlugin = nodeRequire(getName());
          return new HtmlWebpackPlugin({
            inject: false,
            template: path.join(paths.client.sources, template),
            ...rest,
          });
        })(),

      // Extract css if has corresponding loader
      containsLoader(moduleRules, loaders.cssExtractLoader) &&
        (() => {
          // const getName = (): string => 'mini-css-extract-plugin';
          const getName = (): string => 'extract-css-chunks-webpack-plugin';
          const ExtractCssPlugin = nodeRequire(getName());
          const hashStr = appEnv.prod && hash ? '.[contenthash:8]' : '';
          return new ExtractCssPlugin({
            filename: `${buildConfig.client.output.styles}/[name]${hashStr}.css`,
            chunkFilename: `${buildConfig.client.output.styles}/[name]${hashStr}.chunk.css`,
          });
        })(),
      // Minimize css
      (restOptions.optimization?.minimize ?? true) &&
        containsLoader(moduleRules, loaders.cssExtractLoader) &&
        (() => {
          const getName = (): string => 'optimize-css-assets-webpack-plugin';
          const OptimizeCssAssetsPlugin = nodeRequire(getName());
          return new OptimizeCssAssetsPlugin({
            cssProcessorPluginOptions: {
              preset: ['default', { discardComments: { removeAll: true } }],
            },
          });
        })(),

      // Generate a manifest file which contains a mapping of all asset filenames
      // to their corresponding output file so some tools can pick it up without
      // having to parse `index.html`.
      buildConfig.client.output.assetManifest.fileName &&
        (() => {
          const { fileName, filterTemplate } = buildConfig.client.output.assetManifest;
          const isNeedFilter =
            !!filterTemplate && !!Object.getOwnPropertyNames(filterTemplate).length;

          const getName = (): string => 'webpack-manifest-plugin';
          const WebpackManifestPlugin = nodeRequire(getName());
          return new WebpackManifestPlugin({
            fileName,
            filter: !isNeedFilter
              ? undefined
              : (item: Record<string, any>) =>
                  Object.getOwnPropertyNames(filterTemplate).every(
                    (key) => !(key in item) || item[key] === filterTemplate[key]
                  ),
          });
        })(),

      // Generate a service worker script that will precache, and keep up to date,
      // the HTML & assets that are part of the Webpack build.
      appEnv.prod &&
        buildConfig.client.output.sw.swDest &&
        (() => {
          const getName = (): string => 'workbox-webpack-plugin';
          const { GenerateSW } = nodeRequire(getName());
          return new GenerateSW({
            clientsClaim: true,
            importWorkboxFrom: 'cdn',
            exclude: [/\.map$/, new RegExp(`${buildConfig.client.output.assetManifest.fileName}$`)],
            navigateFallback: `${buildConfig.client.output.publicPath}${buildConfig.client.html.filename}`,
            navigateFallbackBlacklist: [
              // Exclude URLs starting with /_, as they're likely an API call
              new RegExp('^/_'),
              // Exclude URLs containing a dot, as they're likely a resource in
              // public/ and not a SPA route
              new RegExp('/[^/]+\\.[^/]+$'),
            ],
            ...buildConfig.client.output.sw,
          });
        })(),

      // Copy public static content to output dir
      appEnv.prod &&
        buildConfig.client.staticContent.length > 0 &&
        (() => {
          const getName = (): string => 'copy-webpack-plugin';
          const CopyPlugin = nodeRequire(getName());
          return new CopyPlugin({
            patterns: paths.client.staticContent.map((p) => ({ from: p })),
          });
        })(),

      ...(restOptions.plugins || []),
    ].filter(Boolean),

    // Some libraries import Node modules but don't use them in the browser.
    // Tell Webpack to provide empty mocks for them so importing them works.
    node: {
      module: 'empty',
      dgram: 'empty',
      dns: 'mock',
      fs: 'empty',
      http2: 'empty',
      net: 'empty',
      tls: 'empty',
      child_process: 'empty',
      ...restOptions.node,
    },

    devServer: {
      contentBase: paths.client.staticContent, // Static content which not processed by webpack and loadable from disk.
      publicPath: buildConfig.client.output.publicPath,
      historyApiFallback: true, // For react subpages handling with webpack-dev-server
      host: '0.0.0.0',
      port: 9000,
      hotOnly: true,
      noInfo: false,
      stats: 'minimal',
      ...restOptions.devServer,
    },
  });
};
