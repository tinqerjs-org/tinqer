/**
 * Advanced SELECT projection tests
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { createSchema, defineSelect } from "@tinqerjs/tinqer";
import { toSql } from "../dist/index.js";

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

  interface Department {
    id: number;
    name: string;
  }

  interface Schema {
    users: User;
    products: Product;
    departments: Department;
  }

  const schema = createSchema<Schema>();

  describe("Complex object projections", () => {
    // Removed: nested object structures with || operator

    it("should handle deeply nested projections", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q.from("products").select((p) => ({
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
        ),
        {},
      );

      expect(result.sql).to.contain(`"id" AS`);
      expect(result.sql).to.contain(`"name" AS`);
      expect(result.sql).to.contain(`"price" AS`);
      expect(result.sql).to.contain(`"cost" AS`);
      expect(result.sql).to.contain(`"stock" AS`);
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
      const result = toSql(
        defineSelect(schema, (q) =>
          q
            .from("products")
            .where((p) => p.stock > 0 && p.price > 10)
            .select((p) => ({
              id: p.id,
              name: p.name,
              price: p.price,
              stock: p.stock,
            })),
        ),
        {},
      );

      expect(result.sql).to.contain('WHERE ("stock" > $(__p1) AND "price" > $(__p2))');
      expect(result.sql).to.contain('"id" AS "id"');
      expect(result.sql).to.contain('"name" AS "name"');
      expect(result.params).to.deep.equal({
        __p1: 0,
        __p2: 10,
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

      interface SchemaWithDepartments {
        users: User;
        departments: Department;
      }

      const dbWithDepartments = createSchema<SchemaWithDepartments>();

      const result = toSql(
        defineSelect(dbWithDepartments, (q) =>
          q
            .from("users")
            .join(
              q.from("departments"),
              (u) => u.departmentId,
              (d) => d.id,
              (u, d) => ({ u, d }),
            )
            .groupBy((joined) => joined.d.name)
            .select((g) => ({
              department: g.key,
              avgSalary: g.avg((joined) => joined.u.salary),
              headcount: g.count(),
            })),
        ),
        {},
      );

      expect(result.sql).to.contain("INNER JOIN");
      expect(result.sql).to.contain("GROUP BY");
      expect(result.sql).to.contain(`AVG("t0"."salary")`);
      expect(result.sql).to.contain("COUNT(*)");
    });

    it("should work with DISTINCT", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q
            .from("products")
            .select((p) => ({
              category: p.categoryId,
              name: p.name,
            }))
            .distinct(),
        ),
        {},
      );

      expect(result.sql).to.contain("SELECT DISTINCT");
      expect(result.sql).to.contain(`"categoryId" AS "category"`);
      expect(result.sql).to.contain(`"name" AS "name"`);
    });
  });

  describe("SELECT with parameters", () => {
    // Test removed: Parameters with arithmetic expressions no longer supported in SELECT
    // Test removed: Mix of parameters with expressions no longer supported in SELECT
  });

  describe("Edge cases in SELECT", () => {
    it("should handle SELECT with only literals", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q.from("users").select(() => ({
            constant: 42,
            message: "Hello World",
            flag: true,
          })),
        ),
        {},
      );

      expect(result.sql).to.contain(`$(__p1) AS "constant"`);
      expect(result.sql).to.contain(`$(__p2) AS "message"`);
      expect(result.sql).to.contain(`$(__p3) AS "flag"`);
      expect(result.params).to.deep.equal({
        __p1: 42,
        __p2: "Hello World",
        __p3: true,
      });
    });

    // Test removed: Very complex nested arithmetic no longer supported in SELECT

    it("should handle SELECT with no projection (identity)", () => {
      const result = toSql(
        defineSelect(schema, (q) => q.from("users").select((u) => u)),
        {},
      );

      expect(result.sql).to.contain("SELECT * FROM");
    });

    it("should handle SELECT with renamed fields", () => {
      const result = toSql(
        defineSelect(schema, (q) =>
          q.from("users").select((u) => ({
            userId: u.id,
            userFirstName: u.firstName,
            userLastName: u.lastName,
            userEmail: u.email,
            userAge: u.age,
          })),
        ),
        {},
      );

      expect(result.sql).to.contain(`"id" AS "userId"`);
      expect(result.sql).to.contain(`"firstName" AS "userFirstName"`);
      expect(result.sql).to.contain(`"lastName" AS "userLastName"`);
      expect(result.sql).to.contain(`"email" AS "userEmail"`);
      expect(result.sql).to.contain(`"age" AS "userAge"`);
    });

    // Test removed: SELECT with many fields containing expressions no longer supported
  });

  describe("SELECT with special cases", () => {
    it("should handle SELECT with pagination pattern", () => {
      const result = toSql(
        defineSelect(schema, (q, params: { page: number; pageSize: number }) =>
          q
            .from("products")
            .select((p) => ({
              id: p.id,
              name: p.name,
              price: p.price,
            }))
            .orderBy((p) => p.id)
            .skip(params.page * params.pageSize)
            .take(params.pageSize),
        ),
        { page: 2, pageSize: 20 },
      );

      expect(result.sql).to.contain(`SELECT "id" AS "id", "name" AS "name", "price" AS "price"`);
      expect(result.sql).to.contain(`ORDER BY "id" ASC`);
      expect(result.sql).to.contain("LIMIT $(pageSize) OFFSET ($(page) * $(pageSize))");
      expect(result.params).to.deep.equal({ page: 2, pageSize: 20 });
    });

    // Test removed: SELECT for reporting query with expressions no longer supported
  });
});
