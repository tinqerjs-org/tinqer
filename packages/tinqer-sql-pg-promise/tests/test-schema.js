/**
 * Test schema for SQL generator tests
 */
import { createContext } from "@webpods/tinqer";
// Create the database context
export const db = createContext();
// Re-export from for use with db context
export { from } from "@webpods/tinqer";
