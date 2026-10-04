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
    files: ["scripts/**/*.mjs", "bin/**/*.js"],
    rules: { "no-console": "off" },
  },
  prettier,
);
