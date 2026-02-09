import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
// biome-ignore lint/performance/noNamespaceImport: drizzle-orm requires all schema exports as a single object
import * as schema from "./schema";

// biome-ignore lint/style/noNonNullAssertion: required env var
const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });
