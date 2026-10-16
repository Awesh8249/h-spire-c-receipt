declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    GOOGLE_SHEETS_WEBHOOK_URL?: string;
    GOOGLE_SHEETS_SECRET_KEY?: string;
    ADMIN_BOOTSTRAP_CODE?: string;
    HEAD_ADMIN_RECOVERY_CODE?: string;
    HEAD_ADMIN_MOBILE?: string;
    SETUP_ADMIN_MOBILES?: string;
    ADMIN_SESSION_SECRET?: string;
  }
}
