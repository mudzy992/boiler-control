module.exports = {
  displayName: 'backend-integration',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/test/integration'],
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'nodenext',
          target: 'ES2023',
          moduleResolution: 'nodenext',
          resolvePackageJsonExports: true,
          lib: ['ES2023'],
          strict: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
        },
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^src\\/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: ['**/*.{ts,js}'],
  testTimeout: 30000,
};
