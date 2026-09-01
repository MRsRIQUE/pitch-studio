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
    "next-env.d.ts",
    // Desktop build staging area (contains a copied Next.js server tree).
    "src-tauri/**",
    // Protótipo anterior em Vite + Fastify, mantido apenas para consulta.
    "legacy/**",
  ]),
]);

export default eslintConfig;
