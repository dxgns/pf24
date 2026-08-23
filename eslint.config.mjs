import { defineConfig, globalIgnores } from "eslint/config";
import nextVitalsModule from "eslint-config-next/core-web-vitals.js";
import nextTsModule from "eslint-config-next/typescript.js";

const nextVitals = nextVitalsModule.default ?? nextVitalsModule;
const nextTs = nextTsModule.default ?? nextTsModule;

const eslintConfig = defineConfig([
  ...(Array.isArray(nextVitals) ? nextVitals : [nextVitals]),
  ...(Array.isArray(nextTs) ? nextTs : [nextTs]),
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
