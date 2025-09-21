/**
 * Tests for complex query chaining
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { query } from "../dist/index.js";

describe("Complex Query Chaining", () => {
  it("should generate complex query with WHERE, SELECT, ORDER BY, TAKE", () => {
    const result = query(
      (p: { minAge: number }) =>
        from<{ id: number; name: string; age: number; isActive: boolean }>("users")
          .where((x) => x.age >= p.minAge && x.isActive)
          .select((x) => ({ id: x.id, name: x.name }))
          .orderBy((x) => x.name)
          .take(10),
      { minAge: 18 },
    );

    expect(result.sql).to.equal(
      'SELECT id AS id, name AS name FROM "users" AS t0 WHERE (age >= $(minAge) AND isActive) ORDER BY name ASC LIMIT 10',
    );
    expect(result.params).to.deep.equal({ minAge: 18 });
  });

  it("should generate query with SKIP and TAKE for pagination", () => {
    const result = query(
      (p: { page: number; pageSize: number }) =>
        from<{ id: number; name: string }>("products")
          .orderBy((x) => x.name)
          .skip(p.page * p.pageSize)
          .take(p.pageSize),
      { page: 2, pageSize: 20 },
    );

    expect(result.sql).to.equal(
      'SELECT * FROM "products" AS t0 ORDER BY name ASC LIMIT $(pageSize) OFFSET ($(page) * $(pageSize))',
    );
    expect(result.params).to.deep.equal({ page: 2, pageSize: 20 });
  });

  it("should generate query with multiple WHERE clauses combined with AND", () => {
    const result = query(
      () =>
        from<{ id: number; age: number; role: string }>("users")
          .where((x) => x.age >= 18)
          .where((x) => x.role == "admin"),
      {},
    );

    expect(result.sql).to.equal("SELECT * FROM \"users\" AS t0 WHERE age >= 18 AND role = 'admin'");
  });

  it("should generate query with DISTINCT", () => {
    const result = query(
      () =>
        from<{ category: string }>("products")
          .select((x) => x.category)
          .distinct(),
      {},
    );

    expect(result.sql).to.equal('SELECT DISTINCT category FROM "products" AS t0');
  });

  it("should generate query with GROUP BY and COUNT aggregate", () => {
    const result = query(
      () =>
        from<{ department: string; salary: number }>("employees")
          .groupBy((x) => x.department)
          .select((g) => ({ department: g.key, count: g.count() })),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT key AS department, COUNT(*) AS count FROM "employees" AS t0 GROUP BY department',
    );
  });
});
