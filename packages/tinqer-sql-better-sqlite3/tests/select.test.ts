/**
 * Tests for SELECT clause generation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { query } from "../dist/index.js";
import { db, from } from "./test-schema.js";

describe("SELECT SQL Generation", () => {
  it("should generate SELECT with single column", () => {
    const result = query(() => from(db, "users").select((x) => x.name), {});

    expect(result.sql).to.equal('SELECT name FROM "users" AS t0');
  });

  it("should generate SELECT with object projection", () => {
    const result = query(
      () =>
        from(db, "users").select((x) => ({
          userId: x.id,
          userName: x.name,
        })),
      {},
    );

    expect(result.sql).to.equal('SELECT id AS userId, name AS userName FROM "users" AS t0');
  });

  // Test removed: Computed values with expressions no longer supported in SELECT projections

  it("should generate SELECT after WHERE", () => {
    const result = query(
      () =>
        from(db, "users")
          .where((x) => x.age >= 18)
          .select((x) => ({ id: x.id, name: x.name })),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT id AS id, name AS name FROM "users" AS t0 WHERE age >= :_age1',
    );
    expect(result.params).to.deep.equal({ _age1: 18 });
  });
});
