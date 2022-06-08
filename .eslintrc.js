module.exports = {
  extends: [
    'airbnb-base',
    'eslint:recommended',
    'plugin:node/recommended',
    'plugin:jest/recommended',
  ],

  parserOptions: {
    ecmaVersion: 2022,
  },

  env: {
    node: true,
  },
};
