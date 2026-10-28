import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    settings: { next: { rootDir: "apps/web" } },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    // The engine must stay runnable by plain Node and portable to any host app.
    files: ["packages/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["react", "react-dom", "three", "next", "next/*", "@react-three/*", "@/*"], message: "@agent-world/core must not depend on React, three, Next or path aliases." },
          ],
        },
      ],
    },
  },
  {
    // R3F model: three.js objects and per-frame scratch state are mutated inside useFrame by design,
    // so the world never re-renders React at frame rate. The React Compiler rule cannot tell them apart.
    files: ["packages/react/src/world/**/*.tsx"],
    rules: { "react-hooks/immutability": "off" },
  },
  { ignores: ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/next-env.d.ts"] },
];

export default config;
