import { describe, it } from "mocha";
import { expect } from "chai";
import { query } from "../dist/index.js";
import { from } from "@webpods/tinqer";

describe("Take SQL Generation", () => {
  interface User {
    id: number;
    name: string;
    age: number;
  }

  it("should generate LIMIT clause", () => {
    const result = query(() => from<User>("users").take(10), {});

    expect(result.sql).to.equal('SELECT * FROM "users" AS "t0" LIMIT $(__p1)');
    expect(result.params).to.deep.equal({ __p1: 10 });
  });

  it("should handle take(1)", () => {
    const result = query(() => from<User>("users").take(1), {});

    expect(result.sql).to.equal('SELECT * FROM "users" AS "t0" LIMIT $(__p1)');
    expect(result.params).to.deep.equal({ __p1: 1 });
  });

  it("should combine take with where", () => {
    const result = query(
      () =>
        from<User>("users")
          .where((u) => u.age > 18)
          .take(5),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT * FROM "users" AS "t0" WHERE "age" > $(__p1) LIMIT $(__p1)',
    );
    expect(result.params).to.deep.equal({ __p1: 18, __p1: 5 });
  });

  it("should combine take with orderBy", () => {
    const result = query(
      () =>
        from<User>("users")
          .orderBy((u) => u.name)
          .take(3),
      {},
    );

    expect(result.sql).to.equal(
      'SELECT * FROM "users" AS "t0" ORDER BY "name" ASC LIMIT $(__p1)',
    );
    expect(result.params).to.deep.equal({ __p1: 3 });
  });
});
