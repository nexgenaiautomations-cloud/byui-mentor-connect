// ESLint flat config for Next 16 (`next lint` was removed in Next 16; see
// node_modules/next/dist/docs/01-app/03-api-reference/05-config/03-eslint.md).
// Run with `npm run lint`. CI treats any error as a failed check.
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Unused code: `_`-prefixed names are deliberate placeholders.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none", ignoreRestSiblings: true },
      ],
      // Unsafe patterns.
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",
      "react/no-danger": "error",
      // Accessibility (jsx-a11y ships with eslint-config-next).
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-role": ["error", { ignoreNonDOM: true }],
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/role-supports-aria-props": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/no-redundant-roles": "error",
      "jsx-a11y/tabindex-no-positive": "error",
    },
  },
  {
    // Node scripts and config files run outside the app bundle.
    files: ["scripts/**/*.{js,mjs,ts}", "*.config.{js,mjs,ts}"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    "public/**",
    "test-results/**",
    "tests/e2e-report/**",
    "playwright-report/**",
    "**/*.tsbuildinfo",
  ]),
]);
