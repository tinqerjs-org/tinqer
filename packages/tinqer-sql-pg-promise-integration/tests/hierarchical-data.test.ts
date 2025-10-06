/**
 * Hierarchical Data Integration Tests
 * Tests for self-referential and tree-structured data queries with real PostgreSQL.
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { executeSelect, executeSelectSimple } from "@webpods/tinqer-sql-pg-promise";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";
import { schema } from "./database-schema.js";

describe("PostgreSQL Integration - Hierarchical Data", () => {
  before(async () => {
    await setupTestDatabase(db);
  });

  describe("Parent-child relationships", () => {
    it("should find root nodes (no parent)", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;
      const results = await executeSelectSimple(
        db,
        schema,
        (q) => q.from("categories").where((c) => c.parent_id == null),
        { onSql: (result) => (capturedSql = result) },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "categories" WHERE "parent_id" IS NULL');
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      expect(results).to.have.length(2); // Electronics and Furniture
      results.forEach((category) => {
        expect(category.parent_id).to.be.null;
        expect(category.level).to.equal(0);
      });
    });

    it("should find children of specific parent", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;
      const parentId = 1; // Electronics
      const results = await executeSelect(
        db,
        schema,
        (q, params) => q.from("categories").where((c) => c.parent_id == params.parentId),
        { parentId },
        { onSql: (result) => (capturedSql = result) },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "categories" WHERE "parent_id" = $(parentId)',
      );
      expect(capturedSql!.params).to.deep.equal({ parentId: 1 });

      expect(results).to.be.an("array");
      expect(results).to.have.length(2); // Computers and Phones
      results.forEach((category) => {
        expect(category.parent_id).to.equal(parentId);
        expect(category.level).to.equal(1);
      });
    });

    it("should find leaf nodes", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;
      const results = await executeSelectSimple(
        db,
        schema,
        (q) => q.from("categories").where((c) => c.is_leaf == true),
        { onSql: (result) => (capturedSql = result) },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "categories" WHERE "is_leaf" = $(__p1)');
      expect(capturedSql!.params).to.deep.equal({ __p1: true });

      expect(results).to.be.an("array");
      expect(results).to.have.length(5); // All level 2 categories (Laptops, Desktops, Smartphones, Chairs, Desks)
      results.forEach((category) => {
        expect(category.is_leaf).to.be.true;
        expect(category.level).to.equal(2);
      });
    });

    it("should find nodes at specific level", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;
      const targetLevel = 1;
      const results = await executeSelect(
        db,
        schema,
        (q, params) => q.from("categories").where((c) => c.level == params.targetLevel),
        { targetLevel },
        { onSql: (result) => (capturedSql = result) },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "categories" WHERE "level" = $(targetLevel)',
      );
      expect(capturedSql!.params).to.deep.equal({ targetLevel: 1 });

      expect(results).to.be.an("array");
      expect(results).to.have.length(3); // Computers, Phones, Office
      results.forEach((category) => {
        expect(category.level).to.equal(targetLevel);
      });
    });
  });

  describe("Path-based queries", () => {
    it("should find by path prefix", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;
      const pathPrefix = "/electronics";
      const results = await executeSelect(
        db,
        schema,
        (q, params) => q.from("categories").where((c) => c.path.startsWith(params.pathPrefix)),
        { pathPrefix },
        { onSql: (result) => (capturedSql = result) },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "categories" WHERE "path" LIKE $(pathPrefix) || \'%\'',
      );
      expect(capturedSql!.params).to.deep.equal({ pathPrefix: "/electronics" });

      expect(results).to.be.an("array");
      expect(results).to.have.length(6); // All electronics categories
      results.forEach((category) => {
        expect(category.path).to.match(/^\/electronics/);
      });
    });

    it("should find descendants using path", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;
      const ancestorPath = "/electronics/computers";
      const pathSuffix = "/";
      const results = await executeSelect(
        db,
        schema,
        (q, params) =>
          q
            .from("categories")
            .where((c) => c.path.startsWith(params.ancestorPath + params.pathSuffix)),
        { ancestorPath, pathSuffix },
        { onSql: (result) => (capturedSql = result) },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "categories" WHERE "path" LIKE ($(ancestorPath) || $(pathSuffix)) || \'%\'',
      );
      expect(capturedSql!.params).to.deep.equal({
        ancestorPath: "/electronics/computers",
        pathSuffix: "/",
      });

      expect(results).to.be.an("array");
      expect(results).to.have.length(2); // Laptops and Desktops
      results.forEach((category) => {
        expect(category.path).to.match(/^\/electronics\/computers\//);
      });
    });

    it("should find by exact path", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;
      const exactPath = "/electronics/phones/smartphones";
      const results = await executeSelect(
        db,
        schema,
        (q, params) => q.from("categories").where((c) => c.path == params.exactPath),
        { exactPath },
        { onSql: (result) => (capturedSql = result) },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "categories" WHERE "path" = $(exactPath)');
      expect(capturedSql!.params).to.deep.equal({ exactPath: "/electronics/phones/smartphones" });

      expect(results).to.be.an("array");
      expect(results).to.have.length(1);
      if (results[0]) {
        expect(results[0].name).to.equal("Smartphones");
      }
    });
  });

  describe("Level-based queries", () => {
    it("should find nodes within level range", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;
      const minLevel = 1;
      const maxLevel = 2;
      const results = await executeSelect(
        db,
        schema,
        (q, params) =>
          q
            .from("categories")
            .where((c) => c.level >= params.minLevel && c.level <= params.maxLevel),
        { minLevel, maxLevel },
        { onSql: (result) => (capturedSql = result) },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "categories" WHERE ("level" >= $(minLevel) AND "level" <= $(maxLevel))',
      );
      expect(capturedSql!.params).to.deep.equal({ minLevel: 1, maxLevel: 2 });

      expect(results).to.be.an("array");
      expect(results).to.have.length(8); // All non-root categories (3 at level 1, 5 at level 2)
      results.forEach((category) => {
        expect(category.level).to.be.at.least(minLevel);
        expect(category.level).to.be.at.most(maxLevel);
      });
    });

    it("should order by level and name", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;
      const results = await executeSelectSimple(
        db,
        schema,
        (q) =>
          q
            .from("categories")
            .orderBy((c) => c.level)
            .thenBy((c) => c.name),
        { onSql: (result) => (capturedSql = result) },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "categories" ORDER BY "level" ASC, "name" ASC',
      );
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      expect(results).to.have.length(10);

      // Verify ordering
      let prevLevel = -1;
      let prevName = "";
      results.forEach((category) => {
        if (category.level === prevLevel) {
          expect(category.name >= prevName).to.be.true;
        } else {
          expect(category.level >= prevLevel).to.be.true;
        }
        prevLevel = category.level;
        prevName = category.name;
      });
    });
  });

  describe("Manager-employee relationships", () => {
    it("should find employees without managers (top level)", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;
      const results = await executeSelectSimple(
        db,
        schema,
        (q) => q.from("users").where((u) => u.manager_id == null),
        { onSql: (result) => (capturedSql = result) },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "manager_id" IS NULL');
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      expect(results).to.have.length(4); // John, Jane, Charlie, Henry
      results.forEach((user) => {
        expect(user.manager_id).to.be.null;
      });
    });

    it("should find all subordinates of a manager", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;
      const managerId = 1; // John Doe
      const results = await executeSelect(
        db,
        schema,
        (q, params) => q.from("users").where((u) => u.manager_id == params.managerId),
        { managerId },
        { onSql: (result) => (capturedSql = result) },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "users" WHERE "manager_id" = $(managerId)');
      expect(capturedSql!.params).to.deep.equal({ managerId: 1 });

      expect(results).to.be.an("array");
      expect(results).to.have.length(4); // Bob, Diana, Frank, Grace
      results.forEach((user) => {
        expect(user.manager_id).to.equal(managerId);
      });
    });

    it("should count subordinates per manager", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;
      const results = await executeSelectSimple(
        db,
        schema,
        (q) =>
          q
            .from("users")
            .where((u) => u.manager_id != null)
            .groupBy((u) => u.manager_id!)
            .select((g) => ({
              managerId: g.key,
              subordinateCount: g.count(),
            })),
        { onSql: (result) => (capturedSql = result) },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "manager_id" AS "managerId", COUNT(*) AS "subordinateCount" FROM "users" WHERE "manager_id" IS NOT NULL GROUP BY "manager_id"',
      );
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);

      // Manager 1 (John) has 4 subordinates
      const johnStats = results.find((r) => r.managerId === 1);
      if (johnStats) {
        expect(johnStats.subordinateCount).to.equal(4);
      }

      // Manager 2 (Jane) has 2 subordinates
      const janeStats = results.find((r) => r.managerId === 2);
      if (janeStats) {
        expect(janeStats.subordinateCount).to.equal(2);
      }
    });
  });

  describe("Comment thread patterns", () => {
    it("should find top-level comments", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;
      const results = await executeSelectSimple(
        db,
        schema,
        (q) => q.from("comments").where((c) => c.parent_comment_id == null),
        { onSql: (result) => (capturedSql = result) },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "comments" WHERE "parent_comment_id" IS NULL',
      );
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      expect(results).to.have.length(2); // Two root comments
      results.forEach((comment) => {
        expect(comment.parent_comment_id).to.be.null;
        expect(comment.depth).to.equal(0);
      });
    });

    it("should find replies to specific comment", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;
      const commentId = 1; // "Great product!"
      const results = await executeSelect(
        db,
        schema,
        (q, params) => q.from("comments").where((c) => c.parent_comment_id == params.commentId),
        { commentId },
        { onSql: (result) => (capturedSql = result) },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "comments" WHERE "parent_comment_id" = $(commentId)',
      );
      expect(capturedSql!.params).to.deep.equal({ commentId: 1 });

      expect(results).to.be.an("array");
      expect(results).to.have.length(2); // "I agree!" and "Thanks for the feedback"
      results.forEach((comment) => {
        expect(comment.parent_comment_id).to.equal(commentId);
        expect(comment.depth).to.equal(1);
      });
    });

    it("should find comments by depth", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;
      const maxDepth = 1;
      const results = await executeSelect(
        db,
        schema,
        (q, params) => q.from("comments").where((c) => c.depth <= params.maxDepth),
        { maxDepth },
        { onSql: (result) => (capturedSql = result) },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "comments" WHERE "depth" <= $(maxDepth)');
      expect(capturedSql!.params).to.deep.equal({ maxDepth: 1 });

      expect(results).to.be.an("array");
      expect(results).to.have.length(5); // All except the depth-2 comment
      results.forEach((comment) => {
        expect(comment.depth).to.be.at.most(maxDepth);
      });
    });

    it("should order comments for threading display", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;
      const results = await executeSelectSimple(
        db,
        schema,
        (q) =>
          q
            .from("comments")
            .orderBy((c) => c.created_at)
            .thenBy((c) => c.depth),
        { onSql: (result) => (capturedSql = result) },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "comments" ORDER BY "created_at" ASC, "depth" ASC',
      );
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      expect(results).to.have.length(6);

      // Comments should be ordered by creation time primarily
      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1];
        const curr = results[i];
        if (prev && curr) {
          const prevTime = new Date(prev.created_at);
          const currTime = new Date(curr.created_at);
          expect(prevTime.getTime()).to.be.at.most(currTime.getTime());
        }
      }
    });
  });

  describe("Self-join patterns", () => {
    it("should join categories with their parents", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;
      const results = await executeSelect(
        db,
        schema,
        (q) =>
          q
            .from("categories")
            .join(
              q.from("categories"),
              (child) => child.parent_id,
              (parent) => parent.id,
              (child, parent) => ({ child, parent }),
            )
            .select((joined) => ({
              childId: joined.child.id,
              childName: joined.child.name,
              parentName: joined.parent.name,
            })),
        {},
        { onSql: (result) => (capturedSql = result) },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "t0"."id" AS "childId", "t0"."name" AS "childName", "t1"."name" AS "parentName" FROM "categories" AS "t0" INNER JOIN "categories" AS "t1" ON "t0"."parent_id" = "t1"."id"',
      );
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      expect(results).to.have.length(8); // All non-root categories
      results.forEach((result) => {
        expect(result).to.have.property("childId");
        expect(result).to.have.property("childName");
        expect(result).to.have.property("parentName");
      });
    });

    it("should find employees with their managers", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;
      const results = await executeSelect(
        db,
        schema,
        (q) =>
          q
            .from("users")
            .join(
              q.from("users"),
              (emp) => emp.manager_id,
              (mgr) => mgr.id,
              (emp, mgr) => ({ emp, mgr }),
            )
            .select((joined) => ({
              employeeName: joined.emp.name,
              managerName: joined.mgr.name,
              employeeDept: joined.emp.department_id,
            })),
        {},
        { onSql: (result) => (capturedSql = result) },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "t0"."name" AS "employeeName", "t1"."name" AS "managerName", "t0"."department_id" AS "employeeDept" FROM "users" AS "t0" INNER JOIN "users" AS "t1" ON "t0"."manager_id" = "t1"."id"',
      );
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      expect(results).to.have.length(6); // All employees with managers
      results.forEach((result) => {
        expect(result).to.have.property("employeeName");
        expect(result).to.have.property("managerName");
        expect(result).to.have.property("employeeDept");
      });
    });

    it("should find siblings (same parent)", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;
      const parentId = 1; // Electronics
      const results = await executeSelect(
        db,
        schema,
        (q, params) =>
          q
            .from("categories")
            .where((c) => c.parent_id == params.parentId)
            .orderBy((c) => c.sort_order),
        { parentId },
        { onSql: (result) => (capturedSql = result) },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "categories" WHERE "parent_id" = $(parentId) ORDER BY "sort_order" ASC',
      );
      expect(capturedSql!.params).to.deep.equal({ parentId: 1 });

      expect(results).to.be.an("array");
      expect(results).to.have.length(2); // Computers and Phones
      if (results[0]) {
        expect(results[0].name).to.equal("Computers");
      }
      if (results[1]) {
        expect(results[1].name).to.equal("Phones");
      }
    });
  });

  describe("Complex hierarchical queries", () => {
    it("should find categories with specific parent and level", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;
      const parentId = 2; // Computers
      const level = 2;
      const results = await executeSelect(
        db,
        schema,
        (q, params) =>
          q
            .from("categories")
            .where(
              (c) => c.parent_id == params.parentId && c.level == params.level && c.is_leaf == true,
            ),
        { parentId, level },
        { onSql: (result) => (capturedSql = result) },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "categories" WHERE (("parent_id" = $(parentId) AND "level" = $(level)) AND "is_leaf" = $(__p1))',
      );
      expect(capturedSql!.params).to.deep.equal({ parentId: 2, level: 2, __p1: true });

      expect(results).to.be.an("array");
      expect(results).to.have.length(2); // Laptops and Desktops
      results.forEach((category) => {
        expect(category.parent_id).to.equal(parentId);
        expect(category.level).to.equal(level);
        expect(category.is_leaf).to.be.true;
      });
    });

    it("should find path between nodes", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;
      const startLevel = 1;
      const endLevel = 2;
      const pathPrefix = "/electronics";
      const results = await executeSelect(
        db,
        schema,
        (q, params) =>
          q
            .from("categories")
            .where(
              (c) =>
                c.path.startsWith(params.pathPrefix) &&
                c.level >= params.startLevel &&
                c.level <= params.endLevel,
            )
            .orderBy((c) => c.level),
        { pathPrefix, startLevel, endLevel },
        { onSql: (result) => (capturedSql = result) },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "categories" WHERE (("path" LIKE $(pathPrefix) || \'%\' AND "level" >= $(startLevel)) AND "level" <= $(endLevel)) ORDER BY "level" ASC',
      );
      expect(capturedSql!.params).to.deep.equal({
        pathPrefix: "/electronics",
        startLevel: 1,
        endLevel: 2,
      });

      expect(results).to.be.an("array");
      expect(results).to.have.length(5); // All electronics except root
      // Should be ordered by level
      results.forEach((category, index) => {
        if (index > 0) {
          const prevResult = results[index - 1];
          if (prevResult) {
            expect(category.level).to.be.at.least(prevResult.level);
          }
        }
      });
    });

    it("should count nodes per level", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;
      const results = await executeSelectSimple(
        db,
        schema,
        (q) =>
          q
            .from("categories")
            .groupBy((c) => c.level)
            .select((g) => ({
              level: g.key,
              nodeCount: g.count(),
            }))
            .orderBy((r) => r.level),
        { onSql: (result) => (capturedSql = result) },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "level" AS "level", COUNT(*) AS "nodeCount" FROM "categories" GROUP BY "level" ORDER BY "level" ASC',
      );
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      expect(results).to.have.length(3); // Levels 0, 1, 2

      if (results[0]) {
        expect(results[0].level).to.equal(0);
        expect(results[0].nodeCount).to.equal(2); // Electronics, Furniture
      }

      if (results[1]) {
        expect(results[1].level).to.equal(1);
        expect(results[1].nodeCount).to.equal(3); // Computers, Phones, Office
      }

      if (results[2]) {
        expect(results[2].level).to.equal(2);
        expect(results[2].nodeCount).to.equal(5); // All leaf nodes
      }
    });
  });

  describe("Performance-oriented hierarchical patterns", () => {
    it("should use path for subtree queries", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;
      const rootPath = "/electronics";
      const pathSuffix = "/";
      const results = await executeSelect(
        db,
        schema,
        (q, params) =>
          q
            .from("categories")
            .where(
              (c) =>
                c.path == params.rootPath || c.path.startsWith(params.rootPath + params.pathSuffix),
            )
            .select((c) => ({
              id: c.id,
              name: c.name,
              relativePath: c.path,
            })),
        { rootPath, pathSuffix },
        { onSql: (result) => (capturedSql = result) },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "id" AS "id", "name" AS "name", "path" AS "relativePath" FROM "categories" WHERE ("path" = $(rootPath) OR "path" LIKE ($(rootPath) || $(pathSuffix)) || \'%\')',
      );
      expect(capturedSql!.params).to.deep.equal({ rootPath: "/electronics", pathSuffix: "/" });

      expect(results).to.be.an("array");
      expect(results).to.have.length(6); // Electronics and all its descendants
      results.forEach((result) => {
        expect(result.relativePath).to.match(/^\/electronics/);
      });
    });

    it("should efficiently check ancestry using path", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;
      const childPath = "/electronics/computers/laptops";
      // Would check if a category is an ancestor by checking if child path starts with ancestor path
      const results = await executeSelect(
        db,
        schema,
        (q, params) =>
          q
            .from("categories")
            .where((c) => params.childPath.startsWith(c.path) && c.path != params.childPath),
        { childPath },
        { onSql: (result) => (capturedSql = result) },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "categories" WHERE ($(childPath) LIKE "path" || \'%\' AND "path" != $(childPath))',
      );
      expect(capturedSql!.params).to.deep.equal({ childPath: "/electronics/computers/laptops" });

      expect(results).to.be.an("array");
      expect(results).to.have.length(2); // Electronics and Computers are ancestors
      expect(results.map((c) => c.name)).to.include.members(["Electronics", "Computers"]);
    });
  });
});
