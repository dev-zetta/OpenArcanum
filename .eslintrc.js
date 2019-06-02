module.exports = {
  globals: {
    server: true
  },
  root: true,
  parser: "babel-eslint",
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module"
  },
  plugins: [
    "ember",
    "prettier",
    "flowtype",
    "standard"
    //'require-path-exists'
  ],
  extends: [
    "eslint:recommended",
    "plugin:ember/recommended",
    "prettier",
    "prettier/flowtype",
    "prettier/standard"
  ],
  env: {
    browser: true,
    node: true
  },
  rules: {
    semi: [2, "never"],
    "ember/no-jquery": "error",
    "prettier/prettier": [
      "error",
      {
        singleQuote: true,
        trailingComma: "none",
        semi: false,
        bracketSpacing: true,
        printWidth: 80,
        tabWidth: 2,
        useTabs: false
      }
    ],
    "padding-line-between-statements": "warn",
    "object-curly-spacing": "warn",
    "no-var": "warn",
    "arrow-body-style": "warn",
    "arrow-parens": "warn",
    "arrow-spacing": "warn",
    "no-await-in-loop": "warn",
    "no-loop-func": "warn",
    "no-magic-numbers": "error",
    "no-return-await": "error",
    "new-parens": "error",
    quotes: [2, "backtick"],
    "no-unused-vars": "off",
    "no-console": "off",
    "no-mixed-spaces-and-tabs": "off",
    "computed-property-spacing": "warn"
    /*"require-path-exists/notEmpty": 2,
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
    }]*/
  },
  overrides: [
    // node files
    {
      files: [
        "index.js",
        "testem.js",
        "ember-cli-build.js",
        "config/**/*.js",
        "tests/dummy/config/**/*.js"
      ],
      parserOptions: {
        sourceType: "script",
        ecmaVersion: 2018
      },
      env: {
        browser: false,
        node: true
      },
      plugins: ['node']
    },

    // test files
    {
      files: ["tests/**/*.js"],
      excludedFiles: ["tests/dummy/**/*.js"],
      env: {
        embertest: true
      }
    }
  ]
};
