import { neon } from "@neondatabase/serverless";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle } from "drizzle-orm/neon-http";
// biome-ignore lint/performance/noNamespaceImport: drizzle-orm requires all schema exports as a single object
import * as schema from "./schema";

let instance: NeonHttpDatabase<typeof schema> | undefined;

function getDb(): NeonHttpDatabase<typeof schema> {
  if (!instance) {
    // biome-ignore lint/style/noNonNullAssertion: required env var
    const sql = neon(process.env.DATABASE_URL!);
    instance = drizzle(sql, { schema });
  }
  return instance;
}

export const db: NeonHttpDatabase<typeof schema> = new Proxy(
  {} as NeonHttpDatabase<typeof schema>,
  {
    get(_target, prop, receiver) {
      return Reflect.get(getDb(), prop, receiver);
    },
  }
);
