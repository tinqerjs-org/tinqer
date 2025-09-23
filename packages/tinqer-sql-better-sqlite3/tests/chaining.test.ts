/**
 * Tests for complex query chaining
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { query } from "../dist/index.js";
import { db, from } from "./test-schema.js";

describe("Complex Query Chaining", () => {
  it("should generate complex query with WHERE, SELECT, ORDER BY, TAKE", () => {
    const result = query(
      (p: { minAge: number }) =>
        from(db, "users")
          .where((x) => x.age >= p.minAge && x.isActive)
          .select((x) => ({ id: x.id, name: x.name }))
          .orderBy((x) => x.name)
          .take(10),
      { minAge: 18 },
    );

    expect(result.sql).to.equal(
      'SELECT id AS id, name AS name FROM "users" AS t0 WHERE (age >= :minAge AND isActive) ORDER BY name ASC LIMIT :_limit1',
    );
    expect(result.params).to.deep.equal({ minAge: 18, _limit1: 10 });
  });

  it("should generate query with SKIP and TAKE for pagination", () => {
    const result = query(
      (p: { page: number; pageSize: number }) =>
        from(db, "products")
          .orderBy((x) => x.name)
          .skip(p.page * p.pageSize)
          .take(p.pageSize),
      { page: 2, pageSize: 20 },
    );

    expect(result.sql).to.equal(
      'SELECT * FROM "products" AS t0 ORDER BY name ASC LIMIT :pageSize OFFSET (:page * :pageSize)',
    );
    expect(result.params).to.deep.equal({ page: 2, pageSize: 20 });
  });

  it("should generate query with multiple WHERE clauses combined with AND", () => {
    const result = query(
      () =>
        from(db, "users")
          .where((x) => x.age >= 18)
          .where((x) => x.role == "admin"),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT * FROM "users" AS t0 WHERE age >= :_age1 AND role = :_role1',
    );
    expect(result.params).to.deep.equal({ _age1: 18, _role1: "admin" });
  });

  it("should generate query with DISTINCT", () => {
    const result = query(
      () =>
        from(db, "products")
          .select((x) => x.category)
          .distinct(),
      {},
    );

    expect(result.sql).to.equal('SELECT DISTINCT category FROM "products" AS t0');
  });

  it("should generate query with GROUP BY and COUNT aggregate", () => {
    const result = query(
      () =>
        from(db, "employees")
          .groupBy((x) => x.department)
          .select((g) => ({ department: g.key, count: g.count() })),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT key AS department, COUNT(*) AS count FROM "employees" AS t0 GROUP BY department',
    );
  });
});
