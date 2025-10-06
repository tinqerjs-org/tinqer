/**
 * Test schema for SQL generator tests
 */
import { createSchema } from "@webpods/tinqer";
// Create the database context
export const db = createSchema();
// Re-export from for use with db context
export { from } from "@webpods/tinqer";
