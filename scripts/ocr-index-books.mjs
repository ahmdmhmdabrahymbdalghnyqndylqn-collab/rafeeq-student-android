import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const API_URL = "https://rafeeq-private-teacher.ahmdmhmdabrahymbdalghnyqndylqn.workers.dev";
const POPPLER = process.env.PDFTOPPM_PATH || "pdftoppm";
const PDF_DIRECTORY = process.env.PDF_SOURCE_DIR || path.join(process.env.USERPROFILE || "", "Documents", "Downloads", "Telegram Desktop");
const CACHE_DIRECTORY = path.join(ROOT, "tmp", "ocr-cache");
const TESSDATA_DIRECTORY = process.env.TESSDATA_PATH || path.join(ROOT, "tmp", "ocr-runtime", "tessdata");
const MAX_PAGES_PER_RUN = Number.parseInt(process.argv.find((item) => item.startsWith("--pages="))?.split("=")[1] || "5", 10);
const SELECTED_BOOK = Number.parseInt(process.argv.find((item) => item.startsWith("--book="))?.split("=")[1] || "0", 10);
const START_PAGE = Number.parseInt(process.argv.find((item) => item.startsWith("--from-page="))?.split("=")[1] || "1", 10);
const PROCESS_ALL = process.argv.includes("--all");
const require = createRequire(import.meta.url);
const tesseractPackage = process.env.TESSERACT_RUNTIME
  ? path.join(process.env.TESSERACT_RUNTIME, "node_modules", "tesseract.js")
  : "tesseract.js";
const { createWorker } = require(tesseractPackage);

function nameKey(value) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\.pdf$/iu, "")
    .replace(/[إأآ]/gu, "ا")
    .replace(/ى/gu, "ي")
    .replace(/ة/gu, "ه")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function pageArgument(value) {
  const numeric = Number.parseInt(value, 10);
  if (!Number.isInteger(numeric) || numeric < 1) throw new Error("Invalid --pages value.");
  return numeric;
}

function chunkText(value) {
  const words = value.replace(/\s+/gu, " ").trim().split(" ");
  const chunks = [];
  let chunk = "";
  for (const word of words) {
    const next = chunk ? `${chunk} ${word}` : word;
    if (next.length > 2200 && chunk) {
      chunks.push(chunk);
      chunk = word;
    } else {
      chunk = next;
    }
  }
  if (chunk.length >= 80) chunks.push(chunk);
  return chunks;
}

async function readCloudflareConfig() {
  const config = await readFile(path.join(ROOT, ".env.cloudflare.ai.local"), "utf8");
  const values = Object.fromEntries(config.split(/\r?\n/u).map((line) => {
    const separator = line.indexOf("=");
    return separator > 0 ? [line.slice(0, separator).trim(), line.slice(separator + 1).trim()] : ["", ""];
  }));
  if (!values.CLOUDFLARE_API_TOKEN) throw new Error("Missing CLOUDFLARE_API_TOKEN in .env.cloudflare.ai.local.");
  return values.CLOUDFLARE_API_TOKEN;
}

async function findPdfFiles() {
  const entries = await readdir(PDF_DIRECTORY, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() && /\.pdf$/iu.test(entry.name)).map((entry) => entry.name);
  if (!files.length) throw new Error(`No PDFs found in ${PDF_DIRECTORY}`);
  return new Map(files.map((file) => [nameKey(file), path.join(PDF_DIRECTORY, file)]));
}

async function renderPage(pdfPath, targetDirectory, page) {
  const prefix = path.join(targetDirectory, `render-${page}`);
  await execFileAsync(POPPLER, ["-f", String(page), "-l", String(page), "-png", "-r", "190", pdfPath, prefix]);
  const files = await readdir(targetDirectory);
  const output = files.find((file) => file.startsWith(`render-${page}-`) && file.endsWith(".png"));
  if (!output) throw new Error(`No image was rendered for page ${page}.`);
  return path.join(targetDirectory, output);
}

async function submitChunks(token, chunks) {
  if (!chunks.length) return 0;
  const ingestKey = createHash("sha256").update(`rafeeq-ingest-v1:${token}`).digest("base64");
  const response = await fetch(`${API_URL}/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-rafeeq-ingest-key": ingestKey },
    body: JSON.stringify({ chunks }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.indexed !== chunks.length) throw new Error(result.error || `Indexing request failed (${response.status}).`);
  return result.indexed;
}

const token = await readCloudflareConfig();
const catalog = JSON.parse(await readFile(path.join(ROOT, "public", "library-catalog.json"), "utf8"));
const pdfFiles = await findPdfFiles();
const books = catalog.filter((book) => !SELECTED_BOOK || book.id === SELECTED_BOOK);
if (!books.length) throw new Error("Requested book was not found in library-catalog.json.");
const pageBudget = PROCESS_ALL ? Number.POSITIVE_INFINITY : pageArgument(MAX_PAGES_PER_RUN);
let pagesDone = 0;
let chunksIndexed = 0;
await mkdir(TESSDATA_DIRECTORY, { recursive: true });
const worker = await createWorker("ara+eng", 1, {
  logger: () => {},
  langPath: TESSDATA_DIRECTORY,
  cachePath: TESSDATA_DIRECTORY,
  gzip: false,
});

try {
  for (const book of books) {
    if (pagesDone >= pageBudget) break;
    const pdfPath = pdfFiles.get(nameKey(book.title));
    if (!pdfPath) throw new Error(`Could not match source PDF for book ${book.id}: ${book.title}`);
    const bookDirectory = path.join(CACHE_DIRECTORY, `book-${String(book.id).padStart(3, "0")}`);
    await mkdir(bookDirectory, { recursive: true });
    for (let page = START_PAGE; page <= book.pages && pagesDone < pageBudget; page += 1) {
      const textFile = path.join(bookDirectory, `page-${String(page).padStart(3, "0")}.txt`);
      let pageText = "";
      try {
        pageText = await readFile(textFile, "utf8");
      } catch {
        const image = await renderPage(pdfPath, bookDirectory, page);
        const result = await worker.recognize(image);
        pageText = result.data.text.trim();
        await writeFile(textFile, pageText, "utf8");
      }
      const chunks = chunkText(pageText).map((text, index) => ({
        id: `book-${book.id}-page-${page}-chunk-${index + 1}`,
        bookId: book.id,
        title: book.title,
        subject: book.subject,
        page,
        text,
      }));
      for (let offset = 0; offset < chunks.length; offset += 30) chunksIndexed += await submitChunks(token, chunks.slice(offset, offset + 30));
      pagesDone += 1;
      process.stdout.write(`Indexed ${book.title}: page ${page}/${book.pages} (${chunks.length} chunks)\n`);
    }
  }
} finally {
  await worker.terminate();
}

process.stdout.write(`Completed ${pagesDone} page(s), indexed ${chunksIndexed} chunk(s).\n`);
