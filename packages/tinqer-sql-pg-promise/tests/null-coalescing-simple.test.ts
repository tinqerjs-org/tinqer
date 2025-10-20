/**
 * Tests for null coalescing operator (??) - using query function
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { createSchema, defineSelect } from "@webpods/tinqer";
import { toSql } from "@webpods/tinqer-sql-pg-promise";

describe("Null Coalescing Operator (??) with query", () => {
  it("should generate COALESCE for ?? operator in WHERE clause", () => {
    interface User {
      status?: string;
    }

    interface Schema {
      users: User;
    }

    const schema = createSchema<Schema>();

    const result = toSql(
      defineSelect(
        schema,
        (q) => q.from("users").where((u) => (u.status ?? "active") === "active"),
      ),
      {},
    );

    expect(result.sql).to.contain("COALESCE");
    expect(result.sql).to.contain("status");
  });

  it("should work with numeric values", () => {
    interface Order {
      priority?: number;
    }

    interface Schema {
      orders: Order;
    }

    const schema = createSchema<Schema>();

    const result = toSql(
      defineSelect(
        schema,
        (q) => q.from("orders").where((o) => (o.priority ?? 5) < 3),
      ),
      {},
    );

    expect(result.sql).to.contain("COALESCE");
    expect(result.sql).to.contain("priority");
  });
});
