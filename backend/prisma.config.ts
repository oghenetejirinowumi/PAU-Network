import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts && tsx prisma/seed-awards.ts",
  },
  datasource: {
    // CLI (migrate, studio) uses the direct, unpooled connection.
    url: env("DIRECT_URL"),
  },
});
