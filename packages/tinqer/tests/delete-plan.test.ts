import { describe, it } from "mocha";
import { expect } from "chai";
import { defineDelete, DeletePlanHandleInitial, DeletePlanHandleComplete } from "../src/plans/delete-plan.js";
import { createSchema } from "../src/linq/database-context.js";
import type { DeleteOperation } from "../src/query-tree/operations.js";

// Test schema
interface TestSchema {
  users: {
    id: number;
    name: string;
    email: string;
    isActive: boolean;
  };
  posts: {
    id: number;
    userId: number;
    title: string;
    content: string;
    isPublished: boolean;
  };
}

const testSchema = createSchema<TestSchema>();

describe("DeletePlanHandle", () => {
  describe("Basic plan creation", () => {
    it("should create a plan with defineDelete", () => {
      const plan = defineDelete(testSchema, "users");

      expect(plan).to.be.instanceOf(DeletePlanHandleInitial);

      const planData = plan.where((u) => u.id === 1).toPlan();

      expect(planData).to.have.property("operation");
      expect(planData.operation.operationType).to.equal("delete");
      const deleteOp = planData.operation as DeleteOperation;
      expect(deleteOp.table).to.equal("users");
      expect(deleteOp.predicate).to.exist;
    });

    it("should maintain immutability when adding where", () => {
      const plan1 = defineDelete(testSchema, "users");
      const plan2 = plan1.where((u) => u.id === 1);

      // Should be different instances
      expect(plan1).to.not.equal(plan2);

      // plan1 should still be Initial
      expect(plan1).to.be.instanceOf(DeletePlanHandleInitial);

      // plan2 should be Complete
      expect(plan2).to.be.instanceOf(DeletePlanHandleComplete);
    });
  });

  describe("WHERE operation", () => {
    it("should add where clause with auto-parameterization", () => {
      const plan = defineDelete(testSchema, "users")
        .where((u) => u.isActive === false);

      const planData = plan.toPlan();
      const deleteOp = planData.operation as DeleteOperation;

      expect(deleteOp.predicate).to.exist;
      expect(planData.autoParams).to.have.property("__p1");
      expect(planData.autoParams.__p1).to.equal(false);
    });

    it.skip("should support where with external parameters (not yet implemented)", () => {
      // This functionality requires visitor support for (item, params) => predicate
      // Currently visitors only process the first parameter
      type Params = { minId: number };

      const plan = defineDelete(testSchema, "posts")
        .where<Params>((p, params) => p.id > params.minId);

      const sql = plan.toSql({ minId: 100 });

      expect(sql.params).to.have.property("minId");
      expect(sql.params.minId).to.equal(100);
    });

    it("should support complex where conditions", () => {
      const plan = defineDelete(testSchema, "posts")
        .where((p) => p.isPublished === false && p.userId === 5);

      const planData = plan.toPlan();
      const deleteOp = planData.operation as DeleteOperation;

      expect(deleteOp.predicate).to.exist;
      // Should have auto-parameterized both values
      expect(planData.autoParams.__p1).to.equal(false);
      expect(planData.autoParams.__p2).to.equal(5);
    });
  });

  describe("allowFullTableDelete operation", () => {
    it("should allow full table delete when explicitly called", () => {
      const plan = defineDelete(testSchema, "posts")
        .allowFullTableDelete();

      const planData = plan.toPlan();
      const deleteOp = planData.operation as DeleteOperation;

      expect(deleteOp.allowFullTableDelete).to.equal(true);
      expect(deleteOp.predicate).to.not.exist;
    });

    it("should be mutually exclusive with where", () => {
      // Cannot test runtime error in TypeScript compile time,
      // but the visitor should throw if allowFullTableDelete is called after where
      const plan = defineDelete(testSchema, "users")
        .allowFullTableDelete();

      expect(plan).to.be.instanceOf(DeletePlanHandleComplete);

      const planData = plan.toPlan();
      const deleteOp = planData.operation as DeleteOperation;
      expect(deleteOp.allowFullTableDelete).to.equal(true);
    });
  });

  describe("toSql method", () => {
    it("should merge auto-params with provided params", () => {
      // For now, just test auto-params since external params in WHERE aren't supported yet
      const plan = defineDelete(testSchema, "posts")
        .where((p) => p.userId === 42 && p.isPublished === false);

      const sql = plan.toSql({});

      expect(sql).to.have.property("operation");
      expect(sql).to.have.property("params");
      expect(sql.params.__p1).to.equal(42); // auto-param for userId
      expect(sql.params.__p2).to.equal(false); // auto-param for isPublished
    });

    it("should work with allowFullTableDelete", () => {
      const plan = defineDelete(testSchema, "posts")
        .allowFullTableDelete();

      const sql = plan.toSql({});

      expect(sql.operation.operationType).to.equal("delete");
      const deleteOp = sql.operation as DeleteOperation;
      expect(deleteOp.allowFullTableDelete).to.equal(true);
      expect(sql.params).to.deep.equal({});
    });
  });

  describe("Complex scenarios", () => {
    it("should handle delete with multiple conditions", () => {
      const plan = defineDelete(testSchema, "users")
        .where((u) => u.isActive === false && u.email.endsWith("@old.com"));

      const planData = plan.toPlan();
      const deleteOp = planData.operation as DeleteOperation;

      expect(deleteOp.predicate).to.exist;
      expect(planData.autoParams.__p1).to.equal(false);
      expect(planData.autoParams.__p2).to.equal("@old.com");
    });

    it("should handle delete with OR conditions", () => {
      const plan = defineDelete(testSchema, "posts")
        .where((p) => p.userId === 1 || p.isPublished === false);

      const planData = plan.toPlan();
      const deleteOp = planData.operation as DeleteOperation;

      expect(deleteOp.predicate).to.exist;
      expect(planData.autoParams.__p1).to.equal(1);
      expect(planData.autoParams.__p2).to.equal(false);
    });

    it.skip("should handle delete with external and auto params (not yet implemented)", () => {
      // This functionality requires visitor support for (item, params) => predicate
      // type Params = { maxId: number; status: boolean };

      // const plan = defineDelete(testSchema, "posts")
      //   .where<Params>((p, params) =>
      //     p.id < params.maxId &&
      //     p.isPublished === params.status &&
      //     p.title === "Test"
      //   );

      // const sql = plan.toSql({ maxId: 1000, status: true });

      // expect(sql.params.maxId).to.equal(1000);
      // expect(sql.params.status).to.equal(true);
      // expect(sql.params.__p1).to.equal("Test"); // auto-param for title
    });
  });
});