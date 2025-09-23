/**
 * Tests for null coalescing operator (??) - using query function
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { query } from "@webpods/tinqer-sql-pg-promise";

describe("Null Coalescing Operator (??) with query", () => {
  it("should generate COALESCE for ?? operator in WHERE clause", () => {
    const result = query(() => from("users").where((u) => (u.status ?? "active") === "active"), {});

    expect(result.sql).to.contain("COALESCE");
    expect(result.sql).to.contain("status");
  });

  it("should work with numeric values", () => {
    const result = query(() => from("orders").where((o) => (o.priority ?? 5) < 3), {});

    expect(result.sql).to.contain("COALESCE");
    expect(result.sql).to.contain("priority");
  });
});
