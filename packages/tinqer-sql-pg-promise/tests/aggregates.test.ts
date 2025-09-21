/**
 * Tests for aggregate function generation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { query } from "../dist/index.js";

describe("Aggregate SQL Generation", () => {
  describe("COUNT", () => {
    it("should generate COUNT(*)", () => {
      const result = query(() => from<{ id: number }>("users").count(), {});

      expect(result.sql).to.equal('SELECT COUNT(*) FROM "users" AS t0');
    });

    it("should generate COUNT with WHERE", () => {
      const result = query(
        () =>
          from<{ id: number; isActive: boolean }>("users")
            .where((x) => x.isActive)
            .count(),
        {},
      );

      expect(result.sql).to.equal('SELECT COUNT(*) FROM "users" AS t0 WHERE isActive');
    });
  });

  describe("SUM", () => {
    it("should generate SUM", () => {
      const result = query(() => from<{ amount: number }>("orders").sum((x) => x.amount), {});

      expect(result.sql).to.equal('SELECT SUM(amount) FROM "orders" AS t0');
    });
  });

  describe("AVG", () => {
    it("should generate AVG", () => {
      const result = query(() => from<{ price: number }>("products").average((x) => x.price), {});

      expect(result.sql).to.equal('SELECT AVG(price) FROM "products" AS t0');
    });
  });

  describe("MIN", () => {
    it("should generate MIN", () => {
      const result = query(() => from<{ age: number }>("users").min((x) => x.age), {});

      expect(result.sql).to.equal('SELECT MIN(age) FROM "users" AS t0');
    });
  });

  describe("MAX", () => {
    it("should generate MAX", () => {
      const result = query(() => from<{ salary: number }>("employees").max((x) => x.salary), {});

      expect(result.sql).to.equal('SELECT MAX(salary) FROM "employees" AS t0');
    });
  });
});
