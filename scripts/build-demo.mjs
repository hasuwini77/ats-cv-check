// Bundles demo-src/main.ts into docs/checker.js (classic script, so the page
// also works when opened straight from file://). The output is committed so
// GitHub Pages can serve docs/ without a build step; CI fails if it is stale.
import { build } from "esbuild";

await build({
  entryPoints: ["demo-src/main.ts"],
  bundle: true,
  format: "iife",
  target: "es2020",
  outfile: "docs/checker.js",
  legalComments: "none",
  logLevel: "warning",
});
console.log("built docs/checker.js");
