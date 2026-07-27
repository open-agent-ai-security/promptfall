import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "outputs/**",
    "public/assets/count.js",
    "next-env.d.ts",
  ]),
  {
    files: ["app/Game.tsx"],
    rules: {
      // Promptfall uses ordinary images as precisely positioned game sprites.
      // Next/Image wrappers would alter that rendering model without providing
      // useful optimization for these bundled static assets.
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
