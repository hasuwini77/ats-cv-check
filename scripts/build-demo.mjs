// Bundles demo/src/main.ts into demo/checker.js (classic script, so the page
// also works when opened straight from file://). The output is committed so
// GitHub Pages can serve demo/ without a build step; CI fails if it is stale.
import { build } from "esbuild";

await build({
  entryPoints: ["demo/src/main.ts"],
  bundle: true,
  format: "iife",
  target: "es2020",
  outfile: "demo/checker.js",
  legalComments: "none",
  logLevel: "warning",
});
console.log("built demo/checker.js");
