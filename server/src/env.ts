import { z } from "zod";

// Checked once at startup, so a missing setting fails the deploy instead of
// the first request that needs it.
const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  // Optional. With it, deleting an account also removes the Supabase login.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  // How many reverse proxies sit in front of the server. Rate limiting needs
  // this to see the visitor's address rather than the proxy's.
  TRUST_PROXY: z.coerce.number().int().min(0).optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
  console.error(`Invalid environment:\n${problems}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
