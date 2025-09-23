/**
 * Shared database connection for all integration tests
 */

import pgPromise from "pg-promise";

// Create a single pgp instance for all tests
export const pgp = pgPromise();

// Create a single database connection for all tests
const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/tinqer_test";
export const db = pgp(connectionString);

// This will be called once after all tests complete
export function closeDatabase() {
  pgp.end();
}