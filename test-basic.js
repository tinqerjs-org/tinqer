// Basic test to verify the query builder works
import { createTinqer } from "./packages/tinqer/dist/index.js";
import { PgPromiseGenerator } from "./packages/tinqer-sql-pg-promise/dist/index.js";

console.log("=== Tinqer Query Builder Test ===\n");

// Create tinqer instance
const tinqer = createTinqer({
  sql: new PgPromiseGenerator(),
});

// Test simple WHERE query
console.log("1. Simple WHERE query:");
const query1 = tinqer
  .table("users")
  .where((u) => u.id === 10)
  .build();

console.log("SQL:", query1.sql);
console.log("Params:", query1.params);
console.log();

// Test multiple WHERE conditions
console.log("2. Multiple WHERE conditions:");
const query2 = tinqer
  .table("users")
  .where((u) => u.age >= 21)
  .where((u) => u.isActive === true)
  .build();

console.log("SQL:", query2.sql);
console.log("Params:", query2.params);
console.log();

// Test SELECT projection
console.log("3. SELECT projection:");
const query3 = tinqer
  .table("users")
  .select((u) => ({ userId: u.id, userName: u.name }))
  .where((u) => u.status === "active")
  .build();

console.log("SQL:", query3.sql);
console.log("Params:", query3.params);
console.log();

// Test ORDER BY
console.log("4. ORDER BY:");
const query4 = tinqer
  .table("users")
  .where((u) => u.age > 18)
  .orderBy((u) => u.name)
  .take(10)
  .build();

console.log("SQL:", query4.sql);
console.log("Params:", query4.params);
console.log();

// Test COUNT aggregate
console.log("5. COUNT query:");
const query5 = tinqer
  .table("users")
  .where((u) => u.isActive === true)
  .count();

console.log("SQL:", query5.sql);
console.log("Params:", query5.params);
console.log();

// Test INSERT
console.log("6. INSERT query:");
const query6 = tinqer.table("users").insert({
  name: "John Doe",
  email: "john@example.com",
  age: 30,
});

console.log("SQL:", query6.sql);
console.log("Params:", query6.params);
console.log();

// Test UPDATE
console.log("7. UPDATE query:");
const query7 = tinqer
  .table("users")
  .where((u) => u.id === 123)
  .update({ lastLogin: new Date("2024-01-01") });

console.log("SQL:", query7.sql);
console.log("Params:", query7.params);
console.log();

// Test DELETE
console.log("8. DELETE query:");
const query8 = tinqer
  .table("users")
  .where((u) => u.status === "deleted")
  .delete();

console.log("SQL:", query8.sql);
console.log("Params:", query8.params);
console.log();

console.log("=== All tests completed ===");
