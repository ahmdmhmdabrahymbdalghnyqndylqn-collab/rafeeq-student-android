declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    BOOKS: R2Bucket;
    ADMIN_PASSWORD: string;
    ADMIN_SESSION_SECRET: string;
  }
}
