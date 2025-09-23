import { from } from "./packages/tinqer/dist/index.js";
const dbContext = {
    users: () => ({ /* table definition */})
};
// Test 1: Can we chain multiple groupBy calls?
try {
    const query1 = from(dbContext, "users")
        .groupBy(u => u.department_id)
        .groupBy(g => g.key); // Try to group again
    console.log("Multiple groupBy compiles:", query1);
}
catch (e) {
    console.log("Multiple groupBy error:", e);
}
// Test 2: What about the IGrouping interface?
const singleGroupBy = from(dbContext, "users")
    .groupBy(u => u.department_id);
// What properties/methods are available on the grouped result?
console.log("Type of grouped query:", typeof singleGroupBy);
console.log("Properties:", Object.keys(singleGroupBy));
