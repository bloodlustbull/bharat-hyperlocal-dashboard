import { readFileSync } from "fs";

const html = readFileSync("index.html", "utf8");

// CSS files loaded
const cssLinks = [...html.matchAll(/href="([^"]+\.css)"/g)].map(m => m[1]);
console.log("CSS loaded:", cssLinks.join(", "));

// Script load order
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*><\/script>/g)];
console.log("\nScript load order:");
scripts.forEach((m, i) => {
  const tag = m[0];
  const type = tag.match(/type="([^"]+)"/)?.[1] || "regular";
  console.log(`  ${i+1}. type=${type} src=${m[1]}`);
});

// Overlay refs in app.js
const app = readFileSync("app.js", "utf8");
const overlayRefs = (app.match(/three-overlay/g) || []).length;
const containerRefs = (app.match(/three-container/g) || []).length;
console.log(`\nthree-overlay refs in app.js: ${overlayRefs}`);
console.log(`three-container refs in app.js: ${containerRefs}`);

// window globals in main.js
const main = readFileSync("src/main.js", "utf8");
const globalAssigns = main.match(/window\.\w+/g) || [];
console.log(`\nwindow globals set by src/main.js: ${[...new Set(globalAssigns)].join(", ")}`);

// Check if styles.css conflicts
const styles = readFileSync("styles.css", "utf8");
const threeTheme = styles.match(/#three-[a-z]+/g) || [];
if (threeTheme.length) console.log(`\nstyles.css has #three-* rules: ${threeTheme.join(", ")}`);
else console.log("\nstyles.css has NO #three-* rules (good, no conflict)");

const threeMain = readFileSync("src/styles/main.css", "utf8");
const threeTheme2 = threeMain.match(/#three-[a-z]+/g) || [];
console.log(`src/styles/main.css has ${threeTheme2.length} #three-* rules`);
