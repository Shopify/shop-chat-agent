import { resolve } from "node:path";

export const TEST_DB_PATH = resolve("prisma/test.sqlite");
export const TEST_DB_URL = `file:${TEST_DB_PATH}`;
