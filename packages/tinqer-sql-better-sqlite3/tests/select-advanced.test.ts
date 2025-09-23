/**
 * Advanced SELECT projection tests
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { query } from "../dist/index.js";

describe("Advanced SELECT Projection SQL Generation", () => {
  interface User {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    age: number;
    salary: number;
    bonus?: number;
    departmentId: number;
    isActive: boolean;
    hireDate?: Date;
  }

  interface Product {
    id: number;
    name: string;
    price: number;
    cost: number;
    stock: number;
    categoryId: number;
    weight?: number;
    dimensions?: { width: number; height: number; depth: number };
    tags?: string[];
  }

  describe("Complex object projections", () => {
    // Removed: nested object structures with || operator

    it("should handle deeply nested projections", () => {
      const result = query(
        () =>
          from<Product>("products").select((p) => ({
            basic: {
              id: p.id,
              name: p.name,
            },
            pricing: {
              retail: p.price,
              cost: p.cost,
              // Removed: arithmetic expressions not allowed in SELECT
              // margin: p.price - p.cost,
              // marginPercent: ((p.price - p.cost) / p.price) * 100,
            },
            inventory: {
              stock: p.stock,
              // Removed: arithmetic expressions not allowed in SELECT
              // value: p.stock * p.cost,
            },
          })),
        {},
      );

      expect(result.sql).to.contain("id AS");
      expect(result.sql).to.contain("name AS");
      expect(result.sql).to.contain("price AS");
      expect(result.sql).to.contain("cost AS");
      expect(result.sql).to.contain("stock AS");
    });
  });

  describe("Computed fields", () => {
    // Test removed: Arithmetic computations no longer supported in SELECT projections
    // Test removed: String concatenation no longer supported in SELECT projections
    // Removed: ternary operators and || defaults
  });

  describe("Multiple SELECT operations", () => {
    // Test removed: Chained SELECT with expressions no longer supported

    it("should project after filtering", () => {
      const result = query(
        () =>
          from<Product>("products")
            .where((p) => p.stock > 0 && p.price > 10)
            .select((p) => ({
              id: p.id,
              name: p.name,
              price: p.price,
              stock: p.stock,
            })),
        {},
      );

      expect(result.sql).to.contain("WHERE (stock > :_stock1 AND price > :_price1)");
      expect(result.sql).to.contain("id AS id");
      expect(result.sql).to.contain("name AS name");
      expect(result.params).to.deep.equal({
        _stock1: 0,
        _price1: 10,
      });
    });
  });

  describe("SELECT with all SQL operations", () => {
    // Test removed: WHERE/ORDER BY/TAKE with expressions no longer supported in SELECT

    it("should work with JOIN and GROUP BY", () => {
      interface Department {
        id: number;
        name: string;
      }

      const result = query(
        () =>
          from<User>("users")
            .join(
              from<Department>("departments"),
              (u) => u.departmentId,
              (d) => d.id,
              (u, d) => ({
                userId: u.id,
                userName: u.firstName + " " + u.lastName,
                deptName: d.name,
                salary: u.salary,
              }),
            )
            .groupBy((x) => x.deptName)
            .select((g) => ({
              department: g.key,
              avgSalary: g.avg((x) => x.salary),
              headcount: g.count(),
            })),
        {},
      );

      expect(result.sql).to.contain("INNER JOIN");
      expect(result.sql).to.contain("GROUP BY");
      expect(result.sql).to.contain("AVG(salary)");
      expect(result.sql).to.contain("COUNT(*)");
    });

    it("should work with DISTINCT", () => {
      const result = query(
        () =>
          from<Product>("products")
            .select((p) => ({
              category: p.categoryId,
              name: p.name,
            }))
            .distinct(),
        {},
      );

      expect(result.sql).to.contain("SELECT DISTINCT");
      expect(result.sql).to.contain("categoryId AS category");
      expect(result.sql).to.contain("name AS name");
    });
  });

  describe("SELECT with parameters", () => {
    // Test removed: Parameters with arithmetic expressions no longer supported in SELECT
    // Test removed: Mix of parameters with expressions no longer supported in SELECT
  });

  describe("Edge cases in SELECT", () => {
    it("should handle SELECT with only literals", () => {
      const result = query(
        () =>
          from<User>("users").select(() => ({
            constant: 42,
            message: "Hello World",
            flag: true,
          })),
        {},
      );

      expect(result.sql).to.contain(":_value1 AS constant");
      expect(result.sql).to.contain(":_value2 AS message");
      expect(result.sql).to.contain(":_value3 AS flag");
      expect(result.params).to.deep.equal({
        _value1: 42,
        _value2: "Hello World",
        _value3: true,
      });
    });

    // Test removed: Very complex nested arithmetic no longer supported in SELECT

    it("should handle SELECT with no projection (identity)", () => {
      const result = query(() => from<User>("users").select((u) => u), {});

      expect(result.sql).to.contain("SELECT * FROM");
    });

    it("should handle SELECT with renamed fields", () => {
      const result = query(
        () =>
          from<User>("users").select((u) => ({
            userId: u.id,
            userFirstName: u.firstName,
            userLastName: u.lastName,
            userEmail: u.email,
            userAge: u.age,
          })),
        {},
      );

      expect(result.sql).to.contain("id AS userId");
      expect(result.sql).to.contain("firstName AS userFirstName");
      expect(result.sql).to.contain("lastName AS userLastName");
      expect(result.sql).to.contain("email AS userEmail");
      expect(result.sql).to.contain("age AS userAge");
    });

    // Test removed: SELECT with many fields containing expressions no longer supported
  });

  describe("SELECT with special cases", () => {
    it("should handle SELECT with pagination pattern", () => {
      const result = query(
        (params: { page: number; pageSize: number }) =>
          from<Product>("products")
            .select((p) => ({
              id: p.id,
              name: p.name,
              price: p.price,
            }))
            .orderBy((p) => p.id)
            .skip(params.page * params.pageSize)
            .take(params.pageSize),
        { page: 2, pageSize: 20 },
      );

      expect(result.sql).to.contain("SELECT id AS id, name AS name, price AS price");
      expect(result.sql).to.contain("ORDER BY id ASC");
      expect(result.sql).to.contain("LIMIT :pageSize OFFSET (:page * :pageSize)");
      expect(result.params).to.deep.equal({ page: 2, pageSize: 20 });
    });

    // Test removed: SELECT for reporting query with expressions no longer supported
  });
});
