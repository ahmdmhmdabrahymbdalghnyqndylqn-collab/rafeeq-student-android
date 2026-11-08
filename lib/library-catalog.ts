import catalog from "../public/library-catalog.json";

export type LibraryBook = {
  id: number;
  title: string;
  subject: string;
  country: string;
  objectKey: string;
  pages: number;
  size: number;
  cover: string;
};

export const libraryCatalog = catalog as LibraryBook[];
