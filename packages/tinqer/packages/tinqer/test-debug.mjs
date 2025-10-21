import { defineSelect } from "./packages/tinqer/dist/plans/select-plan.js";
import { createSchema } from "./packages/tinqer/dist/linq/database-context.js";
import { from } from "./packages/tinqer/dist/linq/from.js";

const testSchema = createSchema();

// Test 1: Works - selectMany in builder
console.log("=== Test 1: selectMany in builder ===");
try {
  const plan1 = defineSelect(testSchema, (q) =>
    q.from("users").selectMany(
      () => from("posts"),
      (u, p) => ({ userId: u.id, postId: p.id })
    )
  );
  console.log("✓ Builder approach works");
  console.log("Operation type:", plan1.toPlan().operation.operationType);
} catch (e) {
  console.log("✗ Builder approach failed:", e.message);
}

// Test 2: Fails - selectMany chained after plan
console.log("\n=== Test 2: selectMany chained on plan handle ===");
try {
  const plan2 = defineSelect(testSchema, (q) => q.from("users"))
    .selectMany(
      () => from("posts"),
      (u, p) => ({ userId: u.id, postId: p.id })
    );
  console.log("✓ Plan handle approach works");
  console.log("Operation type:", plan2.toPlan().operation.operationType);
} catch (e) {
  console.log("✗ Plan handle approach failed:", e.message);
}
