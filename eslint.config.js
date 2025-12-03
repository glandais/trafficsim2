import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-plugin-prettier/recommended";

export default [
  {
    ignores: ["node_modules/**", "dist/**", ".vite/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // Allow console for debugging
      "no-console": "off",
      // Prettier formatting rules
      "prettier/prettier": "error",
    },
  },
];
