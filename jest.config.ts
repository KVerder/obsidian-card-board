module.exports = {
  preset: 'ts-jest',
  transform: {
    '^.+\\.ts?$': ['ts-jest', { isolatedModules: true }],
  },
  testRegex: '/typescript-tests/.*\\.(test|spec)?\\.(ts|tsx)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};

export { };
