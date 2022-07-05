module.exports = {
  parser: '@typescript-eslint/parser',

  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },

  env: {
    node: true,
  },

  extends: [
    'airbnb-base',
    'eslint:recommended',
    'plugin:node/recommended',
    'plugin:jest/recommended',
    'plugin:import/typescript',
    'plugin:@typescript-eslint/recommended',
  ],

  plugins: [
    'node',
    '@typescript-eslint',
  ],

  overrides: [{
    files: '**/*.test.js',
    rules: {
      'node/no-unpublished-require': 'off',
    },
  }],

  rules: {
    // Fixes usage of import/export which is what Typescript needs
    'node/no-unsupported-features/es-syntax': ['error', {
      ignores: ['modules'],
    }],

    // Fixes import without extension which is what Typescript does
    'import/extensions': ['error', 'ignorePackages', {
      js: 'never',
      ts: 'never',
    }],
  },

  settings: {
    // Fixes node/no-missing-import because Node.js does not check .ts files by default
    node: {
      tryExtensions: ['.js', '.json', '.node', '.ts'],
    },
  },
};
