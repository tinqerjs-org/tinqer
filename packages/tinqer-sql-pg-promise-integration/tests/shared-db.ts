/**
 * Shared database connection for all integration tests
 */

import pgPromise from "pg-promise";
import pg from "pg";

// Configure PostgreSQL type parsers for numeric types
// This prevents bigint and numeric types from being returned as strings
pg.types.setTypeParser(20, (val) => parseInt(val, 10)); // bigint -> number
pg.types.setTypeParser(1700, (val) => parseFloat(val)); // numeric/decimal -> number
pg.types.setTypeParser(790, (val) => parseFloat(val)); // money -> number

// Create a single pgp instance for all tests
export const pgp = pgPromise();

// Create a single database connection for all tests
const connectionString =
  process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/tinqer_test";
export const db = pgp(connectionString);

// This will be called once after all tests complete
export function closeDatabase() {
  pgp.end();
}
