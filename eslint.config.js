'use strict';

const browser = {
  window: 'readonly', document: 'readonly', navigator: 'readonly', localStorage: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
  requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly', performance: 'readonly',
  Blob: 'readonly', URL: 'readonly', FileReader: 'readonly', Event: 'readonly',
  AudioContext: 'readonly', webkitAudioContext: 'readonly', getComputedStyle: 'readonly',
  console: 'readonly', TPSettings: 'readonly', TPKeyboard: 'readonly'
};

const node = {
  require: 'readonly', module: 'writable', process: 'readonly', console: 'readonly',
  __dirname: 'readonly', Buffer: 'readonly'
};

const rules = {
  'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
  'no-undef': 'error',
  'no-redeclare': 'error',
  eqeqeq: ['warn', 'smart']
};

module.exports = [
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    files: ['js/**/*.js'],
    languageOptions: { ecmaVersion: 2020, sourceType: 'script', globals: browser },
    rules: rules
  },
  {
    files: ['build.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: node },
    rules: rules
  },
  {
    /* test files are node, but the bodies of page.evaluate() callbacks
       are shipped to the browser, so both sets of globals are in play */
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: Object.assign({}, node, browser)
    },
    rules: rules
  }
];
