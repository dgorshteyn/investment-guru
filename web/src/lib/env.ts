function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy web/.env.example to web/.env.local and fill it in.`
    );
  }
  return value;
}

// Lazy getters — env is read at access time, not module load time, so
// `next build` doesn't blow up when env vars aren't set.
export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
};

export const serverEnv = {
  get supabaseServiceRoleKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  },
  get workerUrl() {
    return process.env.WORKER_URL;
  },
  get workerSharedSecret() {
    return process.env.WORKER_SHARED_SECRET;
  },
  get tiingoApiKey() {
    return process.env.TIINGO_API_KEY;
  },
  get emailAllowlist(): string[] {
    return (process.env.EMAIL_ALLOWLIST ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  },
};

export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = serverEnv.emailAllowlist;
  if (list.length === 0) return false;
  return list.includes(email.toLowerCase());
}
