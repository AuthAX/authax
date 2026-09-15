import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.ts"],
    plugins: { js },
    extends: ["js/recommended"],
    rules: {
      /** https://eslint.org/docs/latest/rules/eqeqeq */
      eqeqeq: "error",
      /** https://eslint.org/docs/latest/rules/guard-for-in */
      "guard-for-in": "error",
      /** https://eslint.org/docs/latest/rules/no-duplicate-imports */
      "no-duplicate-imports": "error",
      /** https://eslint.org/docs/latest/rules/no-useless-rename */
      "no-useless-rename": "error",
      /** https://eslint.org/docs/latest/rules/object-shorthand */
      "object-shorthand": "error",
      /**
       * Disallow the origin global. It is window.origin, so a missing local
       * origin still compiles.
       *
       * https://eslint.org/docs/latest/rules/no-restricted-globals
       */
      "no-restricted-globals": ["error", "origin"],
    },
  },
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      /**
       * Disallow type assertions.
       *
       * https://typescript-eslint.io/rules/consistent-type-assertions/
       */
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "never" },
      ],
      /**
       * Require type over interface. Interfaces can be reopened by declaration
       * merging.
       *
       * https://typescript-eslint.io/rules/consistent-type-definitions/
       */
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
    },
  },
]);
