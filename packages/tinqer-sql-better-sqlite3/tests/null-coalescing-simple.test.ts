/**
 * Tests for null coalescing operator (??) - using query function
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { defineSelect } from "@tinqerjs/tinqer";
import { toSql } from "../dist/index.js";
import { schema } from "./test-schema.js";

describe("Null Coalescing Operator (??) with query", () => {
  it("should generate COALESCE for ?? operator in WHERE clause", () => {
    const result = toSql(
      defineSelect(schema, (q) => q.from("users").where((u) => (u.city ?? "active") === "active")),
      {},
    );

    expect(result.sql).to.contain("COALESCE");
    expect(result.sql).to.contain("city");
  });

  it("should work with numeric values", () => {
    const result = toSql(
      defineSelect(schema, (q) => q.from("orders").where((o) => (o.quantity ?? 5) < 3)),
      {},
    );

    expect(result.sql).to.contain("COALESCE");
    expect(result.sql).to.contain("quantity");
  });
});
