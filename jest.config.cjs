/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-require-imports */
// jest.config.js
const { createDefaultPreset, pathsToModuleNameMapper } = require('ts-jest')

// Read and strip comments so JSON.parse can handle it
const { compilerOptions } = require('./tsconfig.json')

const tsJestTransformCfg = createDefaultPreset().transform

/** @type {import('jest').Config} */
const config = {
  clearMocks: true,
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.?([mc])[jt]s?(x)', '**/*.+(spec|test).?([mc])[jt]s?(x)'],
  transform: {
    ...tsJestTransformCfg,
  },
  roots: ['<rootDir>'],
  modulePaths: [compilerOptions.baseUrl],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' }),
}

module.exports = config
