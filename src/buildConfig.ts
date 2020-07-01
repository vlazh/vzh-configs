import buildConfigDefaults from './buildConfigDefaults';

export type BuildConfig = typeof buildConfigDefaults & {
  envStringify(): { 'process.env.buildConfig': string };
};

export function resolveConfigPath(
  moduleNames = ['build.config', 'apprc'],
  paths = [process.cwd()]
): string {
  let module = '';
  for (let i = 0, name = moduleNames[i]; i < moduleNames.length; i += 1) {
    try {
      // With node 12 it is needed to use prefix './'
      module = require.resolve(`./${name}`, { paths });
      if (module) {
        return module;
      }
    } catch {
      // Ignore errors
    }
  }
  return module;
}

function merge<T1 extends {}, T2 extends Partial<T1>>(obj1: T1, obj2: T2): Omit<T1, keyof T2> & T2 {
  return Array.from(
    new Set([...Object.getOwnPropertyNames(obj1), ...Object.getOwnPropertyNames(obj2)])
  ).reduce((acc, p) => {
    if (Array.isArray(obj1[p]) && Array.isArray(obj2[p])) {
      acc[p] = [...obj1[p], ...obj2[p]];
    } else if (typeof obj1[p] === 'object' && typeof obj2[p] === 'object') {
      acc[p] = merge(obj1[p], obj2[p]);
    } else {
      acc[p] = p in obj2 ? obj2[p] : obj1[p];
    }
    return acc;
  }, {} as Omit<T1, keyof T2> & T2);
}

export function getBuildConfig(configPath = resolveConfigPath()): BuildConfig {
  const buildConfig: BuildConfig =
    process.env.buildConfig ||
    process.env.apprc ||
    process.env.appConfig ||
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    (configPath ? merge(buildConfigDefaults, require(configPath)) : buildConfigDefaults);

  return {
    ...buildConfig,

    /** Stringify all values that we can feed into Webpack DefinePlugin. */
    envStringify() {
      const json = JSON.stringify(this);
      return {
        'process.env.buildConfig': json,
        /** Deprecated. They're saved for prev versions. */
        'process.env.apprc': json,
        'process.env.appConfig': json,
      };
    },
  };
}

/** Use in runtime in browser environment only JSON convertable values, not functions! */
const buildConfig = getBuildConfig();

export default buildConfig;
