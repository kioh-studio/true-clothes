module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  // Mock require() image assets
  moduleNameMapper: {
    '\\.(png|jpg|jpeg|gif)$': '<rootDir>/src/__mocks__/fileMock.js',
  },
};
