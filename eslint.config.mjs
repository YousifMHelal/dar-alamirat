import next from "eslint-config-next";
import prettier from "eslint-config-prettier";

/**
 * Flat ESLint config. `eslint-config-next` 16 ships a native flat-config
 * array (core-web-vitals + TypeScript rules), so we spread it directly
 * and append `eslint-config-prettier` last to switch off any formatting
 * rules that would conflict with Prettier.
 */
const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "src/generated/**",
      "next-env.d.ts",
    ],
  },
  ...next,
  prettier,
];

export default eslintConfig;
