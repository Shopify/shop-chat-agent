import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { TEST_DB_PATH, TEST_DB_URL } from "./db-path.js";

export default function setup() {
  rmSync(TEST_DB_PATH, { force: true });

  const schema = execFileSync(
    "npx",
    ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"],
    { encoding: "utf8" },
  );

  execFileSync("npx", ["prisma", "db", "execute", "--url", TEST_DB_URL, "--stdin"], { input: schema });
}
