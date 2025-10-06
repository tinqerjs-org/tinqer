/**
 * Shared database connection for all integration tests
 */

import Database from "better-sqlite3";

// Create a single database connection for all tests
// Use in-memory database for faster test execution
export const dbClient: Database.Database = new Database(":memory:");

// Enable foreign key constraints
dbClient.pragma("foreign_keys = ON");

// This will be called once after all tests complete
export function closeDatabase() {
  dbClient.close();
}
