import { describe, it } from "mocha";
import { expect } from "chai";
import { defineInsert, InsertPlanHandleInitial, InsertPlanHandleWithValues } from "../src/plans/insert-plan.js";
import { createSchema } from "../src/linq/database-context.js";
import type { InsertOperation } from "../src/query-tree/operations.js";

// Test schema
interface TestSchema {
  users: {
    id: number;
    name: string;
    email: string;
    createdAt: Date;
  };
  posts: {
    id: number;
    userId: number;
    title: string;
    content: string;
  };
}

const testSchema = createSchema<TestSchema>();

describe("InsertPlanHandle", () => {
  describe("Basic plan creation", () => {
    it("should create a plan with defineInsert", () => {
      const plan = defineInsert(testSchema, "users");

      expect(plan).to.be.instanceOf(InsertPlanHandleInitial);

      const planData = plan.values({
        name: "John",
        email: "john@example.com",
      }).toPlan();

      expect(planData).to.have.property("operation");
      expect(planData.operation.operationType).to.equal("insert");
      const insertOp = planData.operation as InsertOperation;
      expect(insertOp.table).to.equal("users");
      expect(insertOp.values).to.have.property("type", "object");
    });

    it("should maintain immutability when adding values", () => {
      const plan1 = defineInsert(testSchema, "users");
      const plan2 = plan1.values({ name: "Alice" });

      // Should be different instances
      expect(plan1).to.not.equal(plan2);

      // plan1 should still be Initial
      expect(plan1).to.be.instanceOf(InsertPlanHandleInitial);

      // plan2 should be WithValues
      expect(plan2).to.be.instanceOf(InsertPlanHandleWithValues);
    });
  });

  describe("Values operation", () => {
    it("should accept object literal values", () => {
      const plan = defineInsert(testSchema, "users")
        .values({
          name: "Bob",
          email: "bob@example.com",
        });

      const planData = plan.toPlan();
      const insertOp = planData.operation as InsertOperation;

      expect(insertOp.values.type).to.equal("object");
      expect(insertOp.values.properties).to.have.property("name");
      expect(insertOp.values.properties).to.have.property("email");
    });

    it("should auto-parameterize literal values", () => {
      const plan = defineInsert(testSchema, "posts")
        .values({
          userId: 1,
          title: "Hello World",
          content: "This is a test post",
        });

      const sql = plan.toSql({});

      // Values should be in the operation
      const insertOp = sql.operation as InsertOperation;
      expect(insertOp.values.type).to.equal("object");
      expect(insertOp.values.properties).to.have.property("userId");
      expect(insertOp.values.properties).to.have.property("title");
      expect(insertOp.values.properties).to.have.property("content");
    });
  });

  describe("Returning operation", () => {
    it("should support returning specific columns", () => {
      const plan = defineInsert(testSchema, "users")
        .values({
          name: "Charlie",
          email: "charlie@example.com",
        })
        .returning((u) => ({ id: u.id, name: u.name }));

      const planData = plan.toPlan();
      const insertOp = planData.operation as InsertOperation;

      expect(insertOp).to.have.property("returning");
      expect(insertOp.returning).to.exist;
    });

    it("should support returning all columns", () => {
      const plan = defineInsert(testSchema, "users")
        .values({
          name: "David",
          email: "david@example.com",
        })
        .returning((u) => u);

      const planData = plan.toPlan();
      const insertOp = planData.operation as InsertOperation;

      expect(insertOp).to.have.property("returning");
      // Should be AllColumnsExpression
      expect(insertOp.returning).to.have.property("type", "allColumns");
    });

    it("should support returning single column", () => {
      const plan = defineInsert(testSchema, "users")
        .values({
          name: "Eve",
          email: "eve@example.com",
        })
        .returning((u) => u.id);

      const planData = plan.toPlan();
      const insertOp = planData.operation as InsertOperation;

      expect(insertOp).to.have.property("returning");
      expect(insertOp.returning).to.exist;
    });
  });

  describe("toSql method", () => {
    it("should merge provided params", () => {
      type Params = { defaultEmail: string };

      const plan = defineInsert(testSchema, "users")
        .values({
          name: "Frank",
          email: "frank@example.com", // In a real scenario, might use params.defaultEmail
        });

      const sql = plan.toSql({ defaultEmail: "default@example.com" } as Params);

      expect(sql).to.have.property("operation");
      expect(sql).to.have.property("params");
      expect(sql.params).to.have.property("defaultEmail", "default@example.com");
    });

    it("should include operation and params in result", () => {
      const plan = defineInsert(testSchema, "users")
        .values({
          name: "Grace",
          email: "grace@example.com",
        });

      const sql = plan.toSql({});

      expect(sql).to.have.property("operation");
      expect(sql.operation.operationType).to.equal("insert");
      expect(sql).to.have.property("params");
    });
  });

  describe("Complex scenarios", () => {
    it("should handle insert with returning and params", () => {
      type Params = { source: string };

      const plan = defineInsert(testSchema, "users")
        .values({
          name: "Helen",
          email: "helen@example.com",
        })
        .returning((u) => ({ id: u.id, createdAt: u.createdAt }));

      const sql = plan.toSql({ source: "api" } as Params);

      expect(sql.operation.operationType).to.equal("insert");
      const insertOp = sql.operation as InsertOperation;
      expect(insertOp.table).to.equal("users");
      expect(insertOp.values).to.exist;
      expect(insertOp.returning).to.exist;
      expect(sql.params.source).to.equal("api");
    });
  });
});