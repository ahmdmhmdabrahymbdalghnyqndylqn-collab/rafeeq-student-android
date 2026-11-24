const REPOSITORY = 'ahmdmhmdabrahymbdalghnyqndylqn-collab/rafeeq-student-android';
const RAW_BASE = `https://raw.githubusercontent.com/${REPOSITORY}/main/public`;
const RELEASE_BASE = `https://github.com/${REPOSITORY}/releases/download/library-2027`;

export type LibraryBook = {
  id: number;
  title: string;
  subject: string;
  country: string;
  pages: number;
  size: number;
  coverUrl: string;
  readUrl: string;
  downloadUrl: string;
};

type RawLibraryBook = {
  id?: unknown;
  title?: unknown;
  subject?: unknown;
  country?: unknown;
  pages?: unknown;
  size?: unknown;
  cover?: unknown;
  objectKey?: unknown;
};

function isRawBook(value: unknown): value is RawLibraryBook {
  return Boolean(value && typeof value === 'object');
}

function fileName(objectKey: string): string {
  const name = objectKey.split('/').pop();
  if (!name || !/^book-\d{3}\.pdf$/u.test(name)) throw new Error('Invalid library file reference.');
  return name;
}

function toBook(value: RawLibraryBook): LibraryBook {
  if (
    typeof value.id !== 'number' ||
    !Number.isInteger(value.id) ||
    typeof value.title !== 'string' ||
    typeof value.subject !== 'string' ||
    typeof value.country !== 'string' ||
    typeof value.pages !== 'number' ||
    !Number.isFinite(value.pages) ||
    typeof value.size !== 'number' ||
    !Number.isFinite(value.size) ||
    typeof value.cover !== 'string' ||
    typeof value.objectKey !== 'string'
  ) {
    throw new Error('The library catalog contains an invalid book.');
  }

  const asset = fileName(value.objectKey);
  const cover = value.cover.replace(/^\/+/, '');
  if (!/^book-covers\/book-\d{3}\.webp$/u.test(cover)) throw new Error('Invalid book cover reference.');

  return {
    id: value.id,
    title: value.title,
    subject: value.subject,
    country: value.country,
    pages: value.pages,
    size: value.size,
    coverUrl: `${RAW_BASE}/${cover}`,
    readUrl: `${RELEASE_BASE}/${asset}`,
    downloadUrl: `${RELEASE_BASE}/${asset}`,
  };
}

export async function fetchLibraryCatalog(signal?: AbortSignal): Promise<LibraryBook[]> {
  const response = await fetch(`${RAW_BASE}/library-catalog.json`, { signal });
  if (!response.ok) throw new Error('Unable to load the library catalog.');
  const raw: unknown = await response.json();
  if (!Array.isArray(raw)) throw new Error('The library catalog is invalid.');

  const books = raw.filter(isRawBook).map(toBook).sort((first, second) => first.id - second.id);
  if (books.length !== 51) throw new Error('The complete 51-book library is not available.');
  return books;
}

export function formatMegabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
