/**
 * Tests for complex query chaining
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { defineSelect } from "@webpods/tinqer";
import { toSql } from "../dist/index.js";
import { schema } from "./test-schema.js";

describe("Complex Query Chaining", () => {
  it("should generate complex query with WHERE, SELECT, ORDER BY, TAKE", () => {
    const result = toSql(
      defineSelect(schema, (q, p: { minAge: number }) =>
        q
          .from("users")
          .where((x) => x.age >= p.minAge && x.isActive)
          .select((x) => ({ id: x.id, name: x.name }))
          .orderBy((x) => x.name)
          .take(10),
      ),
      { minAge: 18 },
    );

    expect(result.sql).to.equal(
      'SELECT "id" AS "id", "name" AS "name" FROM "users" WHERE ("age" >= @minAge AND "isActive") ORDER BY "name" ASC LIMIT @__p1',
    );
    expect(result.params).to.deep.equal({ minAge: 18, __p1: 10 });
  });

  it("should generate query with SKIP and TAKE for pagination", () => {
    const result = toSql(
      defineSelect(schema, (q, p: { page: number; pageSize: number }) =>
        q
          .from("products")
          .orderBy((x) => x.name)
          .skip(p.page * p.pageSize)
          .take(p.pageSize),
      ),
      { page: 2, pageSize: 20 },
    );

    expect(result.sql).to.equal(
      'SELECT * FROM "products" ORDER BY "name" ASC LIMIT @pageSize OFFSET (@page * @pageSize)',
    );
    expect(result.params).to.deep.equal({ page: 2, pageSize: 20 });
  });

  it("should generate query with multiple WHERE clauses combined with AND", () => {
    const result = toSql(
      defineSelect(schema, (q) =>
        q
          .from("users")
          .where((x) => x.age >= 18)
          .where((x) => x.role == "admin"),
      ),
      {},
    );

    expect(result.sql).to.equal('SELECT * FROM "users" WHERE "age" >= @__p1 AND "role" = @__p2');
    expect(result.params).to.deep.equal({ __p1: 18, __p2: "admin" });
  });

  it("should generate query with DISTINCT", () => {
    const result = toSql(
      defineSelect(schema, (q) =>
        q
          .from("products")
          .select((x) => x.category)
          .distinct(),
      ),
      {},
    );

    expect(result.sql).to.equal('SELECT DISTINCT "category" FROM "products"');
  });

  it("should generate query with GROUP BY and COUNT aggregate", () => {
    const result = toSql(
      defineSelect(schema, (q) =>
        q
          .from("employees")
          .groupBy((x) => x.department)
          .select((g) => ({ department: g.key, count: g.count() })),
      ),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT "department" AS "department", COUNT(*) AS "count" FROM "employees" GROUP BY "department"',
    );
  });
});
