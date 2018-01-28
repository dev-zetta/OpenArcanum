module.exports = {
  globals: {
    server: true,
  },
  root: true,
  parserOptions: {
    ecmaVersion: 2017,
    sourceType: 'module'
  },
  plugins: [
    'ember',
    'require-path-exists'
  ],
  extends: [
    'eslint:recommended',
    'plugin:ember/recommended'
  ],
  env: {
    browser: true
  },
  "rules": {
    "no-unused-vars": "off",
    "no-console": "off",
    "no-mixed-spaces-and-tabs": "off",
    "require-path-exists/notEmpty": 2,
    "require-path-exists/tooManyArguments": 2,
    "require-path-exists/exists": [ 2, {
      "extensions": [
        "",
        ".jsx",
        ".es.js",
        ".jsx",
        ".json5",
        ".es",
        ".es6",
        ".coffee"
      ]
    }]
},
  overrides: [
    // node files
    {
      files: [
        'index.js',
        'testem.js',
        'ember-cli-build.js',
        'config/**/*.js',
        'tests/dummy/config/**/*.js'
      ],
      parserOptions: {
        sourceType: 'script',
        ecmaVersion: 2017
      },
      env: {
        browser: false,
        node: true
      }
    },

    // test files
    {
      files: ['tests/**/*.js'],
      excludedFiles: ['tests/dummy/**/*.js'],
      env: {
        embertest: true
      }
    }
  ]
};
