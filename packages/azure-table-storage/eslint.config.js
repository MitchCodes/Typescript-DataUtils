import js from "@eslint/js";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";

export default [
    js.configs.recommended,
    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                ecmaVersion: 2020,
                sourceType: "module",
                project: "./tsconfig.json"
            },
            globals: {
                // Node.js globals
                require: "readonly",
                module: "readonly",
                exports: "readonly",
                __dirname: "readonly",
                __filename: "readonly",
                process: "readonly",
                console: "readonly",
                setTimeout: "readonly",
                NodeJS: "readonly",
                // Jest globals
                jest: "readonly",
                describe: "readonly",
                beforeAll: "readonly",
                beforeEach: "readonly",
                afterAll: "readonly",
                afterEach: "readonly",
                test: "readonly",
                it: "readonly",
                expect: "readonly"
            }
        },
        plugins: {
            "@typescript-eslint": typescript
        },
        rules: {
            ...typescript.configs.recommended.rules,
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unused-vars": "off",
            "@typescript-eslint/no-empty-function": "off",
            "@typescript-eslint/no-require-imports": "off",
            "@typescript-eslint/no-wrapper-object-types": "off",
            "@typescript-eslint/no-namespace": "off",
            "@typescript-eslint/no-unsafe-function-type": "off",
            "no-console": "off",
            "no-redeclare": "off",
            "no-case-declarations": "off",
            "no-self-assign": "off",
            "no-undef": "off",
            "prefer-const": "off"
        }
    },
    {
        ignores: ["build/**", "coverage/**", "node_modules/**", "*.js", "jest.config.js", "jest/**/*.js"]
    }
];