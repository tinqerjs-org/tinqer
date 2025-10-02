/**
 * Tests for null coalescing operator (??) - using query function
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { selectStatement } from "../dist/index.js";

describe("Null Coalescing Operator (??) with query", () => {
  it("should generate COALESCE for ?? operator in WHERE clause", () => {
    interface User {
      status?: string;
    }
    const result = selectStatement(
      () => from<User>("users").where((u) => (u.status ?? "active") === "active"),
      {},
    );

    expect(result.sql).to.contain("COALESCE");
    expect(result.sql).to.contain("status");
  });

  it("should work with numeric values", () => {
    interface Order {
      priority?: number;
    }
    const result = selectStatement(
      () => from<Order>("orders").where((o) => (o.priority ?? 5) < 3),
      {},
    );

    expect(result.sql).to.contain("COALESCE");
    expect(result.sql).to.contain("priority");
  });
});
