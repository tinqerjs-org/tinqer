/**
 * Tests for null coalescing operator (??) - using query function
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { createContext } from "@webpods/tinqer";
import { selectStatement } from "@webpods/tinqer-sql-pg-promise";

describe("Null Coalescing Operator (??) with query", () => {
  it("should generate COALESCE for ?? operator in WHERE clause", () => {
    interface User {
      status?: string;
    }

    interface Schema {
      users: User;
    }

    const db = createContext<Schema>();

    const result = selectStatement(
      db,
      (ctx) => ctx.from("users").where((u) => (u.status ?? "active") === "active"),
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

    const db = createContext<Schema>();

    const result = selectStatement(
      db,
      (ctx) => ctx.from("orders").where((o) => (o.priority ?? 5) < 3),
      {},
    );

    expect(result.sql).to.contain("COALESCE");
    expect(result.sql).to.contain("priority");
  });
});
