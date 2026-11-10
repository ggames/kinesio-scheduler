import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import ts from 'typescript';

const { config: tsconfig } = ts.readConfigFile('./tsconfig.json', ts.sys.readFile);
const paths = tsconfig?.compilerOptions?.paths ?? {};

/**
 * Jest config for NestJS 12 (pure ESM) + ts-jest + Jest 30.
 *
 * Runs with: node --experimental-vm-modules node_modules/.bin/jest
 *
 * Key settings:
 * - extensionsToTreatAsEsm: ['.ts'] → Jest treats .ts files as ESM
 * - useESM: true → ts-jest emits import/export instead of require/exports
 * - transformIgnorePatterns allows @nestjs/* to be transpiled
 */
const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json',
        useESM: true,
      },
    ],
  },
  // Don't transform anything in node_modules — they're already ESM,
  // and Jest in ESM mode can handle them natively.
  transformIgnorePatterns: [],
  moduleNameMapper: pathsToModuleNameMapper(paths, { prefix: '<rootDir>/' }),
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.spec.(t|j)s',
    '!src/**/*.module.(t|j)s',
  ],
  coverageDirectory: './coverage',
  coverageThreshold: {
    global: {
      statements: 38,
      branches: 33,
      functions: 27,
      lines: 38,
    },
  },
  testEnvironment: 'node',
};

export default config;
