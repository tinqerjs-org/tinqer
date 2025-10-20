/**
 * Tests for SELECT clause generation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { defineSelect } from "@webpods/tinqer";
import { toSql } from "../dist/index.js";
import { schema } from "./test-schema.js";

describe("SELECT SQL Generation", () => {
  it("should generate SELECT with single column", () => {
    const result = toSql(defineSelect(schema, (q) => q.from("users").select((x) => x.name)), {});

    expect(result.sql).to.equal('SELECT "name" FROM "users"');
  });

  it("should generate SELECT with object projection", () => {
    const result = toSql(
      defineSelect(
        schema,
        (q) =>
          q.from("users").select((x) => ({
            userId: x.id,
            userName: x.name,
          })),
      ),
      {},
    );

    expect(result.sql).to.equal('SELECT "id" AS "userId", "name" AS "userName" FROM "users"');
  });

  // Test removed: Computed values with expressions no longer supported in SELECT projections

  it("should generate SELECT after WHERE", () => {
    const result = toSql(
      defineSelect(
        schema,
        (q) =>
          q
            .from("users")
            .where((x) => x.age >= 18)
            .select((x) => ({ id: x.id, name: x.name })),
      ),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT "id" AS "id", "name" AS "name" FROM "users" WHERE "age" >= $(__p1)',
    );
    expect(result.params).to.deep.equal({ __p1: 18 });
  });
});
