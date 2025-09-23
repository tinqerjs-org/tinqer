import { query, from } from "./packages/tinqer-sql-pg-promise/dist/index.js";

const result = query(() => from("products").where((p) => p.price * 0.9 > 100), {});

console.log("SQL:", result.sql);
console.log("Params:", result.params);
