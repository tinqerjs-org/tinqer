import { describe, it } from "mocha";
import { expect } from "chai";
import { defineSelect, createSchema } from "@webpods/tinqer";
import { toSql } from "../dist/index.js";

describe("Take SQL Generation", () => {
  interface User {
    id: number;
    name: string;
    age: number;
  }

  interface Schema {
    users: User;
  }

  const schema = createSchema<Schema>();

  it("should generate LIMIT clause", () => {
    const result = toSql(defineSelect(schema, (q) => q.from("users").take(10)), {});

    expect(result.sql).to.equal('SELECT * FROM "users" LIMIT $(__p1)');
    expect(result.params).to.deep.equal({ __p1: 10 });
  });

  it("should handle take(1)", () => {
    const result = toSql(defineSelect(schema, (q) => q.from("users").take(1)), {});

    expect(result.sql).to.equal('SELECT * FROM "users" LIMIT $(__p1)');
    expect(result.params).to.deep.equal({ __p1: 1 });
  });

  it("should combine take with where", () => {
    const result = toSql(
      defineSelect(
        schema,
        (q) =>
          q
            .from("users")
            .where((u) => u.age > 18)
            .take(5),
      ),
      {},
    );

    expect(result.sql).to.equal('SELECT * FROM "users" WHERE "age" > $(__p1) LIMIT $(__p2)');
    expect(result.params).to.deep.equal({ __p1: 18, __p2: 5 });
  });

  it("should combine take with orderBy", () => {
    const result = toSql(
      defineSelect(
        schema,
        (q) =>
          q
            .from("users")
            .orderBy((u) => u.name)
            .take(3),
      ),
      {},
    );

    expect(result.sql).to.equal('SELECT * FROM "users" ORDER BY "name" ASC LIMIT $(__p1)');
    expect(result.params).to.deep.equal({ __p1: 3 });
  });
});
