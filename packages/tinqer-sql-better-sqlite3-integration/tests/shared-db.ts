/**
 * Shared database connection for all integration tests
 */

import Database from "better-sqlite3";

// Create a single database connection for all tests
// Use in-memory database for faster test execution
export const db: Database.Database = new Database(":memory:");

// Enable foreign key constraints
db.pragma("foreign_keys = ON");

// This will be called once after all tests complete
export function closeDatabase() {
  db.close();
}
