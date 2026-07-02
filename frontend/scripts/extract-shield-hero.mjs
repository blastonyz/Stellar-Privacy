import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.resolve(__dirname, "../../shield-hero.html");
const outPath = path.resolve(__dirname, "../components/landing/shield-hero-extracted.js");

const html = fs.readFileSync(htmlPath, "utf8");
const start = html.indexOf("<script>");
const end = html.lastIndexOf("</script>");
let js = html.slice(start + 8, end);
js = js.replace(/var PHOTO_URL = "data:image[^"]+";/, 'var PHOTO_URL = "/back-1.jpg";');
fs.writeFileSync(outPath, js);
console.log("written", js.length, "chars to", outPath);
