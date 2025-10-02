// @ts-check
import parser from "@typescript-eslint/parser";
import plugin from "@typescript-eslint/eslint-plugin";

const config = [
  { ignores: ["**/dist/**", "**/node_modules/**"] },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    },
    plugins: {
      "@typescript-eslint": plugin,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
];

export default config;
