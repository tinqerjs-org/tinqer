/**
 * Global hooks for all integration tests
 */

import { closeDatabase } from "./shared-db.js";

// This runs after all tests in all files are complete
after(() => {
  console.log("Closing database connection...");
  closeDatabase();
});