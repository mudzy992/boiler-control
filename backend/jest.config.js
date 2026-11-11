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
  /*
   * Zadanih 5000 ms je tijesno za testove koji dižu cijeli `AppModule` preko
   * `Test.createTestingModule` i onda izvrše nekoliko HTTP zahtjeva. Na CI
   * runneru sa 2 jezgre to povremeno pređe 5 s i test padne kao „exceeded
   * timeout" — a stvarno je isteklo vrijeme, ne greška u kodu.
   *
   * Integracioni set (`jest-integration.config.js`) je već imao 30 s; ovo je
   * isti prag i za ugovorne testove, koji rade isto.
   */
  testTimeout: 30_000,
};
