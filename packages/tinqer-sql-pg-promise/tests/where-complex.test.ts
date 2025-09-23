/**
 * Tests for complex WHERE clause SQL generation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { query } from "../dist/index.js";

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

  describe("Nested logical conditions", () => {
    it("should handle complex nested AND/OR conditions", () => {
      const result = query(
        () =>
          from<User>("users").where(
            (u) =>
              (u.age >= 18 && u.age <= 65 && u.isActive) ||
              (u.role == "admin" && u.departmentId == 1),
          ),
        {},
      );

      expect(result.sql).to.contain('(("age" >= $(_age1) AND "age" <= $(_age2)) AND "isActive")');
      expect(result.sql).to.contain(
        'OR ("role" = $(_role1) AND "departmentId" = $(_departmentId1)))',
      );
      expect(result.params).to.deep.equal({
        _age1: 18,
        _age2: 65,
        _role1: "admin",
        _departmentId1: 1,
      });
    });

    it("should handle deeply nested conditions", () => {
      const result = query(
        () =>
          from<Product>("products").where(
            (p) =>
              ((p.price > 100 && p.price < 500) || (p.discount != null && p.discount > 20)) &&
              p.isAvailable &&
              p.stock > 0,
          ),
        {},
      );

      expect(result.sql).to.contain(`"price" > $(_price1)`);
      expect(result.sql).to.contain(`"price" < $(_price2)`);
      expect(result.sql).to.contain(`"discount" IS NOT NULL`);
      expect(result.sql).to.contain(`"discount" > $(_discount1)`);
      expect(result.sql).to.contain(`"isAvailable"`);
      expect(result.sql).to.contain(`"stock" > $(_stock1)`);
      expect(result.params).to.deep.equal({
        _price1: 100,
        _price2: 500,
        _discount1: 20,
        _stock1: 0,
      });
    });

    it("should handle multiple NOT conditions", () => {
      const result = query(
        () =>
          from<User>("users").where(
            (u) => !(u.role == "guest") && !!u.isActive && !(u.age < 18 || u.age > 99),
          ),
        {},
      );

      expect(result.sql).to.contain("NOT");
      expect(result.params).to.have.property("_role1", "guest");
      expect(result.params).to.have.property("_age1", 18);
      expect(result.params).to.have.property("_age2", 99);
    });
  });

  describe("Range conditions", () => {
    it("should handle BETWEEN-like conditions", () => {
      const result = query(
        () => from<Product>("products").where((p) => p.price >= 50 && p.price <= 200),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "products" AS "t0" WHERE ("price" >= $(_price1) AND "price" <= $(_price2))',
      );
      expect(result.params).to.deep.equal({ _price1: 50, _price2: 200 });
    });

    it("should handle multiple range conditions", () => {
      const result = query(
        () =>
          from<User>("users").where(
            (u) =>
              u.age >= 25 && u.age <= 35 && (u.salary || 0) >= 50000 && (u.salary || 0) <= 100000,
          ),
        {},
      );

      expect(result.sql).to.contain(`"age" >= $(_age1)`);
      expect(result.sql).to.contain(`"age" <= $(_age2)`);
      expect(result.params).to.have.property("_age1", 25);
      expect(result.params).to.have.property("_age2", 35);
    });

    it("should handle exclusive ranges", () => {
      const result = query(
        () => from<Product>("products").where((p) => p.stock > 10 && p.stock < 100),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "products" AS "t0" WHERE ("stock" > $(_stock1) AND "stock" < $(_stock2))',
      );
      expect(result.params).to.deep.equal({ _stock1: 10, _stock2: 100 });
    });
  });

  describe("IN-like conditions", () => {
    it("should handle OR conditions simulating IN", () => {
      const result = query(
        () =>
          from<User>("users").where(
            (u) => u.role == "admin" || u.role == "manager" || u.role == "supervisor",
          ),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" AS "t0" WHERE (("role" = $(_role1) OR "role" = $(_role2)) OR "role" = $(_role3))',
      );
      expect(result.params).to.deep.equal({
        _role1: "admin",
        _role2: "manager",
        _role3: "supervisor",
      });
    });

    it("should handle NOT IN-like conditions", () => {
      const result = query(
        () =>
          from<User>("users").where(
            (u) => u.role != "guest" && u.role != "blocked" && u.role != "suspended",
          ),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" AS "t0" WHERE (("role" != $(_role1) AND "role" != $(_role2)) AND "role" != $(_role3))',
      );
      expect(result.params).to.deep.equal({
        _role1: "guest",
        _role2: "blocked",
        _role3: "suspended",
      });
    });
  });

  describe("NULL handling", () => {
    it("should handle complex NULL checks", () => {
      const result = query(
        () =>
          from<User>("users").where(
            (u) => (u.salary == null && u.role == "intern") || (u.salary != null && u.salary > 0),
          ),
        {},
      );

      expect(result.sql).to.contain(`"salary" IS NULL`);
      expect(result.sql).to.contain(`"role" = $(_role1)`);
      expect(result.sql).to.contain(`"salary" IS NOT NULL`);
      expect(result.sql).to.contain(`"salary" > $(_salary1)`);
      expect(result.params).to.deep.equal({
        _role1: "intern",
        _salary1: 0,
      });
    });

    it("should handle nullable field with default values", () => {
      const result = query(
        () =>
          from<Product>("products").where((p) => (p.discount || 0) > 10 && (p.discount || 0) < 50),
        {},
      );

      expect(result.sql).to.contain(">");
      expect(result.sql).to.contain("<");
      expect(result.params).to.have.property("_value1");
      expect(result.params).to.have.property("_value2");
    });
  });

  describe("Arithmetic expressions in WHERE", () => {
    it("should handle arithmetic comparisons", () => {
      const result = query(() => from<Product>("products").where((p) => p.price * 0.9 > 100), {});

      expect(result.sql).to.contain(`("price" * $(_price1)) > $(_value1)`);
      expect(result.params).to.deep.equal({ _price1: 0.9, _value1: 100 });
    });

    it("should handle complex arithmetic expressions", () => {
      const result = query(
        () =>
          from<Product>("products").where(
            (p) => p.price - (p.discount || 0) > 50 && p.stock * p.price < 10000,
          ),
        {},
      );

      expect(result.sql).to.contain("-");
      expect(result.sql).to.contain("*");
      expect(result.sql).to.contain(">");
      expect(result.sql).to.contain("<");
    });

    it("should handle division and modulo", () => {
      const result = query(() => from<User>("users").where((u) => u.id % 2 == 0), {});

      expect(result.sql).to.contain(`("id" % $(_id1)) = $(_value1)`);
      expect(result.params).to.deep.equal({ _id1: 2, _value1: 0 });
    });
  });

  describe("Mixed type comparisons", () => {
    it("should handle boolean, number, and string conditions together", () => {
      const result = query(
        () =>
          from<User>("users").where(
            (u) =>
              u.isActive == true && u.age >= 21 && u.name != "Anonymous" && (u.salary || 0) > 30000,
          ),
        {},
      );

      expect(result.sql).to.contain(`"isActive" = $(_isActive1)`);
      expect(result.sql).to.contain(`"age" >= $(_age1)`);
      expect(result.sql).to.contain(`"name" != $(_name1)`);
      expect(result.params).to.deep.equal({
        _isActive1: true,
        _age1: 21,
        _name1: "Anonymous",
        _value1: 0,
        _value2: 30000,
      });
    });

    it("should handle type coercion scenarios", () => {
      const result = query(
        () => from<User>("users").where((u) => u.id > 0 && u.isActive && u.age != null),
        {},
      );

      expect(result.sql).to.contain(`"id" > $(_id1)`);
      expect(result.sql).to.contain(`"isActive"`);
      expect(result.sql).to.contain(`"age" IS NOT NULL`);
      expect(result.params).to.deep.equal({
        _id1: 0,
      });
    });
  });

  describe("Multiple WHERE clauses chained", () => {
    it("should combine 3 WHERE clauses", () => {
      const result = query(
        () =>
          from<User>("users")
            .where((u) => u.age >= 18)
            .where((u) => u.isActive)
            .where((u) => u.role != "guest"),
        {},
      );

      expect(result.sql).to.equal(
        'SELECT * FROM "users" AS "t0" WHERE "age" >= $(_age1) AND "isActive" AND "role" != $(_role1)',
      );
      expect(result.params).to.deep.equal({ _age1: 18, _role1: "guest" });
    });

    it("should combine 5 WHERE clauses", () => {
      const result = query(
        () =>
          from<Product>("products")
            .where((p) => p.price > 10)
            .where((p) => p.stock > 0)
            .where((p) => p.isAvailable)
            .where((p) => p.categoryId != 999)
            .where((p) => p.name != ""),
        {},
      );

      expect(result.sql).to.contain(`"price" > $(_price1)`);
      expect(result.sql).to.contain(`"stock" > $(_stock1)`);
      expect(result.sql).to.contain(`"isAvailable"`);
      expect(result.sql).to.contain(`"categoryId" != $(_categoryId1)`);
      expect(result.sql).to.contain(`"name" != $(_name1)`);
      expect(result.params).to.deep.equal({
        _price1: 10,
        _stock1: 0,
        _categoryId1: 999,
        _name1: "",
      });
    });
  });

  describe("WHERE with parameters", () => {
    it("should handle complex conditions with external parameters", () => {
      const result = query(
        (params: { minAge: number; maxAge: number; roles: string[]; isActive: boolean }) =>
          from<User>("users").where(
            (u) =>
              u.age >= params.minAge &&
              u.age <= params.maxAge &&
              u.isActive == params.isActive &&
              (u.role == params.roles[0] || u.role == params.roles[1]),
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
      });
    });

    it("should mix parameters with auto-parameterized constants", () => {
      const result = query(
        (params: { threshold: number }) =>
          from<Product>("products").where(
            (p) =>
              p.price > params.threshold &&
              p.stock > 10 &&
              p.discount != null &&
              p.isAvailable == true,
          ),
        { threshold: 100 },
      );

      expect(result.sql).to.contain(`"price" > $(threshold)`);
      expect(result.sql).to.contain(`"stock" > $(_stock1)`);
      expect(result.sql).to.contain(`"discount" IS NOT NULL`);
      expect(result.sql).to.contain(`"isAvailable" = $(_isAvailable1)`);
      expect(result.params).to.deep.equal({
        threshold: 100,
        _stock1: 10,
        _isAvailable1: true,
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle very long condition chains", () => {
      const result = query(
        () =>
          from<User>("users").where(
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
        {},
      );

      expect(Object.keys(result.params).length).to.be.greaterThan(8);
    });

    it("should handle conditions with all comparison operators", () => {
      const result = query(
        () =>
          from<Product>("products").where(
            (p) =>
              p.id == 100 ||
              p.price != 0 ||
              p.stock > 10 ||
              p.stock >= 5 ||
              (p.discount ?? 0) < 50 ||
              (p.discount ?? 0) <= 75,
          ),
        {},
      );

      expect(result.sql).to.contain(`"id" = $(_id1)`);
      expect(result.sql).to.contain(`"price" != $(_price1)`);
      expect(result.sql).to.contain(`"stock" > $(_stock1)`);
      expect(result.sql).to.contain(`"stock" >= $(_stock2)`);
      expect(result.sql).to.contain(`"discount" < $(_discount1)`);
      expect(result.sql).to.contain(`"discount" <= $(_discount2)`);
    });

    it("should handle false boolean literals correctly", () => {
      const result = query(() => from<User>("users").where((u) => u.isActive == false), {});

      expect(result.sql).to.equal(`SELECT * FROM "users" AS "t0" WHERE "isActive" = $(_isActive1)`);
      expect(result.params).to.deep.equal({ _isActive1: false });
    });
  });
});
