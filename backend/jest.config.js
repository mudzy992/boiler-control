module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  roots: ['<rootDir>/src', '<rootDir>/test'],
  moduleNameMapper: { '^src/(.*)$': '<rootDir>/src/$1' },
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node',
          resolvePackageJsonExports: false,
          target: 'es2021',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          declaration: false,
          emitDecoratorMetadata: true,
          experimentalDecorators: true,
        },
      },
    ],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
