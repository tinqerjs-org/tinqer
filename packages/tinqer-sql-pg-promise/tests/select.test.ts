/**
 * Tests for SELECT clause generation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { query } from "../dist/index.js";

describe("SELECT SQL Generation", () => {
  it("should generate SELECT with single column", () => {
    const result = query(
      () => from<{ id: number; name: string; age: number }>("users").select((x) => x.name),
      {},
    );

    expect(result.sql).to.equal('SELECT name FROM "users" AS t0');
  });

  it("should generate SELECT with object projection", () => {
    const result = query(
      () =>
        from<{ id: number; name: string; age: number }>("users").select((x) => ({
          userId: x.id,
          userName: x.name,
        })),
      {},
    );

    expect(result.sql).to.equal('SELECT id AS userId, name AS userName FROM "users" AS t0');
  });

  it("should generate SELECT with computed values", () => {
    const result = query(
      () =>
        from<{ firstName: string; lastName: string; age: number }>("users").select((x) => ({
          fullName: x.firstName + " " + x.lastName,
          ageInMonths: x.age * 12,
        })),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT firstName || $(_firstName1) || lastName AS fullName, (age * $(_age1)) AS ageInMonths FROM "users" AS t0',
    );
    expect(result.params).to.deep.equal({ _firstName1: " ", _age1: 12 });
  });

  it("should generate SELECT after WHERE", () => {
    const result = query(
      () =>
        from<{ id: number; name: string; age: number }>("users")
          .where((x) => x.age >= 18)
          .select((x) => ({ id: x.id, name: x.name })),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT id AS id, name AS name FROM "users" AS t0 WHERE age >= $(_age1)',
    );
    expect(result.params).to.deep.equal({ _age1: 18 });
  });
});
