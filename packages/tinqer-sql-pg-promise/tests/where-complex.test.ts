/**
 * Tests for complex WHERE clause SQL generation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { createSchema, defineSelect } from "@webpods/tinqer";
import { toSql } from "../dist/index.js";

describe("Complex WHERE Clause SQL Generation", () => {
  interface User {
    id: number;
    name: string;
    age: number;
    isActive: boolean;
    role: string;
    salary?: number;
    departmentId?: number;
    createdAt?: Date;
  }

  interface Product {
    id: number;
    name: string;
    price: number;
    stock: number;
    categoryId: number;
    isAvailable: boolean;
    discount?: number;
  }

  interface Schema {
    users: User;
    products: Product;
  }

  const schema = createSchema<Schema>();

  describe("Nested logical conditions", () => {
    it("should handle complex nested AND/OR conditions", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q
            .from("users")
            .where(
              (u) =>
                (u.age >= 18 && u.age <= 65 && u.isActive) ||
                (u.role == "admin" && u.departmentId == 1),
            ),
        ),
        {},
      );

      expect(result.sql).to.contain('(("age" >= $(__p1) AND "age" <= $(__p2)) AND "isActive")');
      expect(result.sql).to.contain('OR ("role" = $(__p3) AND "departmentId" = $(__p4))');
      expect(result.params).to.deep.equal({
        __p1: 18,
        __p2: 65,
        __p3: "admin",
        __p4: 1,
      });
    });

    it("should handle deeply nested conditions", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q
            .from("products")
            .where(
              (p) =>
                ((p.price > 100 && p.price < 500) || (p.discount != null && p.discount > 20)) &&
                p.isAvailable &&
                p.stock > 0,
            ),
        ),
        {},
      );

      expect(result.sql).to.contain(`"price" > $(__p1)`);
      expect(result.sql).to.contain(`"price" < $(__p2)`);
      expect(result.sql).to.contain(`"discount" IS NOT NULL`);
      expect(result.sql).to.contain(`"discount" > $(__p3)`);
      expect(result.sql).to.contain(`"isAvailable"`);
      expect(result.sql).to.contain(`"stock" > $(__p4)`);
      expect(result.params).to.deep.equal({
        __p1: 100,
        __p2: 500,
        __p3: 20,
        __p4: 0,
      });
    });

    it("should handle multiple NOT conditions", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q
            .from("users")
            .where((u) => !(u.role == "guest") && !!u.isActive && !(u.age < 18 || u.age > 99)),
        ),
        {},
      );

      expect(result.sql).to.contain("NOT");
      expect(result.params).to.have.property("__p1", "guest");
      expect(result.params).to.have.property("__p2", 18);
      expect(result.params).to.have.property("__p3", 99);
    });
  });

  describe("Range conditions", () => {
    it("should handle BETWEEN-like conditions", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q.from("products").where((p) => p.price >= 50 && p.price <= 200),
        ),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "products" WHERE ("price" >= $(__p1) AND "price" <= $(__p2))',
      );
      expect(result.params).to.deep.equal({ __p1: 50, __p2: 200 });
    });

    it("should handle multiple range conditions", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q
            .from("users")
            .where(
              (u) =>
                u.age >= 25 && u.age <= 35 && (u.salary || 0) >= 50000 && (u.salary || 0) <= 100000,
            ),
        ),
        {},
      );

      expect(result.sql).to.contain(`"age" >= $(__p1)`);
      expect(result.sql).to.contain(`"age" <= $(__p2)`);
      expect(result.params).to.have.property("__p1", 25);
      expect(result.params).to.have.property("__p2", 35);
    });

    it("should handle exclusive ranges", () => {
      const result = toSql(
        defineSelect(schema, (q) => q.from("products").where((p) => p.stock > 10 && p.stock < 100)),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "products" WHERE ("stock" > $(__p1) AND "stock" < $(__p2))',
      );
      expect(result.params).to.deep.equal({ __p1: 10, __p2: 100 });
    });
  });

  describe("IN-like conditions", () => {
    it("should handle OR conditions simulating IN", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q
            .from("users")
            .where((u) => u.role == "admin" || u.role == "manager" || u.role == "supervisor"),
        ),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE (("role" = $(__p1) OR "role" = $(__p2)) OR "role" = $(__p3))',
      );
      expect(result.params).to.deep.equal({
        __p1: "admin",
        __p2: "manager",
        __p3: "supervisor",
      });
    });

    it("should handle NOT IN-like conditions", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q
            .from("users")
            .where((u) => u.role != "guest" && u.role != "blocked" && u.role != "suspended"),
        ),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE (("role" != $(__p1) AND "role" != $(__p2)) AND "role" != $(__p3))',
      );
      expect(result.params).to.deep.equal({
        __p1: "guest",
        __p2: "blocked",
        __p3: "suspended",
      });
    });
  });

  describe("NULL handling", () => {
    it("should handle complex NULL checks", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q
            .from("users")
            .where(
              (u) => (u.salary == null && u.role == "intern") || (u.salary != null && u.salary > 0),
            ),
        ),
        {},
      );

      expect(result.sql).to.contain(`"salary" IS NULL`);
      expect(result.sql).to.contain(`"role" = $(__p1)`);
      expect(result.sql).to.contain(`"salary" IS NOT NULL`);
      expect(result.sql).to.contain(`"salary" > $(__p2)`);
      expect(result.params).to.deep.equal({
        __p1: "intern",
        __p2: 0,
      });
    });

    it("should handle nullable field with default values", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q.from("products").where((p) => (p.discount || 0) > 10 && (p.discount || 0) < 50),
        ),
        {},
      );

      expect(result.sql).to.contain(">");
      expect(result.sql).to.contain("<");
      expect(result.params).to.have.property("__p1");
      expect(result.params).to.have.property("__p2");
    });
  });

  describe("Arithmetic expressions in WHERE", () => {
    it("should handle arithmetic comparisons", () => {
      const result = toSql(
        defineSelect(schema, (q) => q.from("products").where((p) => p.price * 0.9 > 100)),
        {},
      );

      expect(result.sql).to.contain(`("price" * $(__p1)) > $(__p2)`);
      expect(result.params).to.deep.equal({ __p1: 0.9, __p2: 100 });
    });

    it("should handle complex arithmetic expressions", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q
            .from("products")
            .where((p) => p.price - (p.discount || 0) > 50 && p.stock * p.price < 10000),
        ),
        {},
      );

      expect(result.sql).to.contain("-");
      expect(result.sql).to.contain("*");
      expect(result.sql).to.contain(">");
      expect(result.sql).to.contain("<");
    });

    it("should handle division and modulo", () => {
      const result = toSql(
        defineSelect(schema, (q) => q.from("users").where((u) => u.id % 2 == 0)),
        {},
      );

      expect(result.sql).to.contain(`("id" % $(__p1)) = $(__p2)`);
      expect(result.params).to.deep.equal({ __p1: 2, __p2: 0 });
    });
  });

  describe("Mixed type comparisons", () => {
    it("should handle boolean, number, and string conditions together", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q
            .from("users")
            .where(
              (u) =>
                u.isActive == true &&
                u.age >= 21 &&
                u.name != "Anonymous" &&
                (u.salary || 0) > 30000,
            ),
        ),
        {},
      );

      expect(result.sql).to.contain(`"isActive" = $(__p1)`);
      expect(result.sql).to.contain(`"age" >= $(__p2)`);
      expect(result.sql).to.contain(`"name" != $(__p3)`);
      expect(result.params).to.deep.equal({
        __p1: true,
        __p2: 21,
        __p3: "Anonymous",
        __p4: 0,
        __p5: 30000,
      });
    });

    it("should handle type coercion scenarios", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q.from("users").where((u) => u.id > 0 && u.isActive && u.age != null),
        ),
        {},
      );

      expect(result.sql).to.contain(`"id" > $(__p1)`);
      expect(result.sql).to.contain(`"isActive"`);
      expect(result.sql).to.contain(`"age" IS NOT NULL`);
      expect(result.params).to.deep.equal({
        __p1: 0,
      });
    });
  });

  describe("Multiple WHERE clauses chained", () => {
    it("should combine 3 WHERE clauses", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q
            .from("users")
            .where((u) => u.age >= 18)
            .where((u) => u.isActive)
            .where((u) => u.role != "guest"),
        ),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" WHERE "age" >= $(__p1) AND "isActive" AND "role" != $(__p2)',
      );
      expect(result.params).to.deep.equal({ __p1: 18, __p2: "guest" });
    });

    it("should combine 5 WHERE clauses", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q
            .from("products")
            .where((p) => p.price > 10)
            .where((p) => p.stock > 0)
            .where((p) => p.isAvailable)
            .where((p) => p.categoryId != 999)
            .where((p) => p.name != ""),
        ),
        {},
      );

      expect(result.sql).to.contain(`"price" > $(__p1)`);
      expect(result.sql).to.contain(`"stock" > $(__p2)`);
      expect(result.sql).to.contain(`"isAvailable"`);
      expect(result.sql).to.contain(`"categoryId" != $(__p3)`);
      expect(result.sql).to.contain(`"name" != $(__p4)`);
      expect(result.params).to.deep.equal({
        __p1: 10,
        __p2: 0,
        __p3: 999,
        __p4: "",
      });
    });
  });

  describe("WHERE with parameters", () => {
    it("should handle complex conditions with external parameters", () => {
      const result = toSql(
        defineSelect(
          schema,
          (q, params: { minAge: number; maxAge: number; roles: string[]; isActive: boolean }) =>
            q
              .from("users")
              .where(
                (u) =>
                  u.age >= params.minAge &&
                  u.age <= params.maxAge &&
                  u.isActive == params.isActive &&
                  (u.role == params.roles[0] || u.role == params.roles[1]),
              ),
        ),
        { minAge: 25, maxAge: 55, roles: ["admin", "manager"], isActive: true },
      );

      expect(result.sql).to.contain(`"age" >= $(minAge)`);
      expect(result.sql).to.contain(`"age" <= $(maxAge)`);
      expect(result.sql).to.contain(`"isActive" = $(isActive)`);
      expect(result.params).to.deep.equal({
        minAge: 25,
        maxAge: 55,
        roles: ["admin", "manager"],
        isActive: true,
        roles_0: "admin",
        roles_1: "manager",
      });
    });

    it("should mix parameters with auto-parameterized constants", () => {
      const result = toSql(
        defineSelect(schema, (q, params: { threshold: number }) =>
          q
            .from("products")
            .where(
              (p) =>
                p.price > params.threshold &&
                p.stock > 10 &&
                p.discount != null &&
                p.isAvailable == true,
            ),
        ),
        { threshold: 100 },
      );

      expect(result.sql).to.contain(`"price" > $(threshold)`);
      expect(result.sql).to.contain(`"stock" > $(__p1)`);
      expect(result.sql).to.contain(`"discount" IS NOT NULL`);
      expect(result.sql).to.contain(`"isAvailable" = $(__p2)`);
      expect(result.params).to.deep.equal({
        threshold: 100,
        __p1: 10,
        __p2: true,
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle very long condition chains", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q
            .from("users")
            .where(
              (u) =>
                u.id > 0 &&
                u.id < 1000000 &&
                u.age >= 0 &&
                u.age <= 150 &&
                u.name != "" &&
                u.name != null &&
                u.role != "deleted" &&
                u.isActive == true &&
                (u.salary || 0) >= 0 &&
                (u.departmentId || 0) > 0,
            ),
        ),
        {},
      );

      expect(Object.keys(result.params).length).to.be.greaterThan(8);
    });

    it("should handle conditions with all comparison operators", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q
            .from("products")
            .where(
              (p) =>
                p.id == 100 ||
                p.price != 0 ||
                p.stock > 10 ||
                p.stock >= 5 ||
                (p.discount ?? 0) < 50 ||
                (p.discount ?? 0) <= 75,
            ),
        ),
        {},
      );

      expect(result.sql).to.contain(`"id" = $(__p1)`);
      expect(result.sql).to.contain(`"price" != $(__p2)`);
      expect(result.sql).to.contain(`"stock" > $(__p3)`);
      expect(result.sql).to.contain(`"stock" >= $(__p4)`);
      expect(result.sql).to.contain(`COALESCE("discount", $(__p5)) < $(__p6)`);
      expect(result.sql).to.contain(`COALESCE("discount", $(__p7)) <= $(__p8)`);
    });

    it("should handle false boolean literals correctly", () => {
      const result = toSql(
        defineSelect(schema, (q) => q.from("users").where((u) => u.isActive == false)),
        {},
      );

      expect(result.sql).to.equal(`SELECT * FROM "users" WHERE "isActive" = $(__p1)`);
      expect(result.params).to.deep.equal({ __p1: false });
    });
  });
});
