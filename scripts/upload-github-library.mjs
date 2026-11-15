import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";

const owner = "ahmdmhmdabrahymbdalghnyqndylqn-collab";
const repo = "rafeeq-student-android";
const tag = "library-2027";
const token = process.env.GITHUB_TOKEN;
const requestedIds = new Set(process.argv.slice(2).map(Number).filter(Number.isInteger));

if (!token) throw new Error("GITHUB_TOKEN is required.");

const headers = {
  authorization: `Bearer ${token}`,
  accept: "application/vnd.github+json",
  "x-github-api-version": "2022-11-28",
  "user-agent": "Rafeeq-Student-Library-Uploader",
};

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${(await response.text()).slice(0, 500)}`);
  }
  return response.status === 204 ? null : response.json();
}

async function release() {
  const endpoint = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`;
  try {
    return await api(endpoint);
  } catch (error) {
    if (!String(error.message).includes("404")) throw error;
    return api(`https://api.github.com/repos/${owner}/${repo}/releases`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tag_name: tag,
        name: "Rafeeq Student Library 2027",
        body: "الكتب تُحمَّل فقط عند اختيار القراءة أو التنزيل من تطبيق رفيق الطالب.",
        draft: false,
        prerelease: false,
      }),
    });
  }
}

async function upload(uploadUrl, name, filePath) {
  const size = (await stat(filePath)).size;
  const url = `${uploadUrl.replace("{?name,label}", "")}?name=${encodeURIComponent(name)}`;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/pdf",
        "content-length": String(size),
      },
      body: createReadStream(filePath),
      duplex: "half",
    });
    if (response.ok) return response.json();
    const body = await response.text();
    const alreadyExists = response.status === 422 && body.includes("already_exists");
    if (alreadyExists) return { alreadyExists: true };
    if (attempt === 4 || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
      throw new Error(`Upload ${name} failed (${response.status}): ${body.slice(0, 500)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));
  }
}

const manifest = JSON.parse(await readFile(new URL("../output/pdf/manifest.json", import.meta.url), "utf8"));
const target = await release();
const existing = new Set((target.assets || []).map((asset) => asset.name));
let uploaded = 0;

for (const book of manifest.filter((item) => requestedIds.size === 0 || requestedIds.has(item.id))) {
  const name = `book-${String(book.id).padStart(3, "0")}.pdf`;
  if (existing.has(name)) {
    console.log(`EXISTS ${book.id}/51 ${name}`);
    continue;
  }
  const result = await upload(target.upload_url, name, book.prepared);
  if (result.alreadyExists) console.log(`EXISTS ${book.id}/51 ${name}`);
  else {
    uploaded += 1;
    console.log(`UPLOADED ${book.id}/51 ${name}`);
  }
}

console.log(JSON.stringify({ tag, uploaded, total: manifest.length }));
