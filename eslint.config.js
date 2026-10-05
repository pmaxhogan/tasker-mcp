import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Flat config. Type-aware linting is deliberately off; the tsc typecheck job
 * already covers what the typed rules would add.
 *
 * The em dash / en dash ban is enforced by scripts/check-ascii.mjs rather than
 * a lint rule, because it also has to cover Markdown and YAML.
 */
export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/coverage/**", "**/node_modules/**", "tmp/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      eqeqeq: ["error", "smart"],
      "no-implicit-coercion": "error",
      "object-shorthand": "error",
      "prefer-const": "error",
    },
  },
  {
    // stdout is the MCP stdio channel: a stray console.log corrupts the protocol.
    files: ["src/**/*.ts"],
    rules: { "no-console": "error" },
  },
  {
    // JavaScriptlets that run inside Tasker: plain scripts whose top-level
    // vars are outputs copied back into the task, with Tasker's builtins and
    // the HTTP Request event's locals as globals.
    files: ["tasker/js/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        enableProfile: "readonly",
        global: "readonly",
        local: "readonly",
        readFile: "readonly",
        setGlobal: "readonly",
        setLocal: "readonly",
        writeFile: "readonly",
        http_request_body: "readonly",
        http_request_headers: "readonly",
        http_request_method: "readonly",
        http_request_path: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
      "no-useless-assignment": "off",
    },
  },
  {
    files: ["scripts/**/*.mjs", "bin/**/*.js"],
    rules: { "no-console": "off" },
  },
  prettier,
);
