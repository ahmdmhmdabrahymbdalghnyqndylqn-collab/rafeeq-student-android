import { readFile, writeFile } from "node:fs/promises";

const appPath = new URL("../android/app/src/main/assets/index.html", import.meta.url);
const catalogPath = new URL("../public/library-catalog.json", import.meta.url);
const app = await readFile(appPath, "utf8");
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const embedded = JSON.stringify(catalog).replace(/</g, "\\u003c");

if (!app.includes("const embeddedCatalog = [];")) {
  throw new Error("Offline catalog placeholder is missing.");
}

await writeFile(appPath, app.replace("const embeddedCatalog = [];", `const embeddedCatalog = ${embedded};`));
