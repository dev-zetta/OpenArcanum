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
    "prettier",
    'require-path-exists'
  ],
  extends: [
    'eslint:recommended',
    'plugin:ember/recommended',
    'prettier/flowtype',
    "prettier/standard"
  ],
  env: {
    browser: false,
    node: true
  },
  rules: {
    semi: [2, 'never'],
    'no-return-await': 2,
  'prettier/prettier': ['error', {
    singleQuote: true,
    trailingComma: 'none',
    semi: false,
    bracketSpacing: true,
    printWidth: 80,
    tabWidth: 2,
    useTabs: false
  }],
    "no-unused-vars": "off",
    "no-console": "off",
    "no-mixed-spaces-and-tabs": "off",
    "require-path-exists/notEmpty": 2,
    "require-path-exists/tooManyArguments": 2,
    "require-path-exists/exists": [ 2, {
      "extensions": [
        "",
        ".jsx",
        ".jsx",
        ".json5",
        ".es",
        ".es6"
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
