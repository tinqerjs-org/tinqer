/**
 * Tests comparing DATE vs TIMESTAMP column behavior
 * DATE columns only store the date part, TIMESTAMP stores date + time
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { executeSelect } from "@webpods/tinqer-sql-pg-promise";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";
import { schema } from "./database-schema.js";

describe("PostgreSQL Integration - DATE vs TIMESTAMP Columns", () => {
  before(async () => {
    await setupTestDatabase(db);
  });

  describe("DATE column behavior (orders.order_date)", () => {
    it("should match dates regardless of time component", async () => {
      let capturedSql1: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql2: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql3: { sql: string; params: Record<string, unknown> } | undefined;

      // Create dates with different times
      const date1 = new Date("2024-01-15"); // 00:00:00
      const date2 = new Date("2024-01-15T12:00:00"); // 12:00:00
      const date3 = new Date("2024-01-15T23:59:59"); // 23:59:59

      // All three should match the same DATE value
      const results1 = await executeSelect(
        db,
        schema,
        (ctx, params) => ctx.from("orders").where((o) => o.order_date == params.targetDate),
        { targetDate: date1 },
        {
          onSql: (result) => {
            capturedSql1 = result;
          },
        },
      );

      const results2 = await executeSelect(
        db,
        schema,
        (ctx, params) => ctx.from("orders").where((o) => o.order_date == params.targetDate),
        { targetDate: date2 },
        {
          onSql: (result) => {
            capturedSql2 = result;
          },
        },
      );

      const results3 = await executeSelect(
        db,
        schema,
        (ctx, params) => ctx.from("orders").where((o) => o.order_date == params.targetDate),
        { targetDate: date3 },
        {
          onSql: (result) => {
            capturedSql3 = result;
          },
        },
      );

      expect(capturedSql1).to.exist;
      expect(capturedSql1!.sql).to.equal(
        'SELECT * FROM "orders" WHERE "order_date" = $(targetDate)',
      );
      expect(capturedSql1!.params.targetDate).to.be.instanceOf(Date);

      expect(capturedSql2).to.exist;
      expect(capturedSql2!.sql).to.equal(
        'SELECT * FROM "orders" WHERE "order_date" = $(targetDate)',
      );
      expect(capturedSql2!.params.targetDate).to.be.instanceOf(Date);

      expect(capturedSql3).to.exist;
      expect(capturedSql3!.sql).to.equal(
        'SELECT * FROM "orders" WHERE "order_date" = $(targetDate)',
      );
      expect(capturedSql3!.params.targetDate).to.be.instanceOf(Date);

      // All should return the same order
      expect(results1).to.have.length(1);
      expect(results2).to.have.length(1);
      expect(results3).to.have.length(1);

      expect(results1[0]?.id).to.equal(results2[0]?.id);
      expect(results2[0]?.id).to.equal(results3[0]?.id);
    });

    it("should compare DATE columns properly with inequality", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      // Use UTC midnight for DATE column comparison
      const targetDate = new Date("2024-01-18T00:00:00.000Z");

      const results = await executeSelect(
        db,
        schema,
        (ctx, params) => ctx.from("orders").where((o) => o.order_date != params.targetDate),
        { targetDate },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "orders" WHERE "order_date" != $(targetDate)',
      );
      expect(capturedSql!.params.targetDate).to.be.instanceOf(Date);

      // Should return all orders except Order ID 4 (which has date 2024-01-18 in the database)
      expect(results).to.have.length(9);

      // Check that Order ID 4 is excluded
      const orderIds = results.map((o) => o.id);
      expect(orderIds).to.not.include(4);
    });
  });

  describe("TIMESTAMP column behavior (events.start_date)", () => {
    it("should require exact time match for equality", async () => {
      let capturedSql1: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql2: { sql: string; params: Record<string, unknown> } | undefined;

      // These are different timestamps
      const midnight = new Date("2024-01-15"); // 00:00:00
      const actual = new Date("2024-01-15T09:00:00"); // 09:00:00 (actual time in DB)

      const resultsMidnight = await executeSelect(
        db,
        schema,
        (ctx, params) => ctx.from("events").where((e) => e.start_date == params.targetDate),
        { targetDate: midnight },
        {
          onSql: (result) => {
            capturedSql1 = result;
          },
        },
      );

      const resultsActual = await executeSelect(
        db,
        schema,
        (ctx, params) => ctx.from("events").where((e) => e.start_date == params.targetDate),
        { targetDate: actual },
        {
          onSql: (result) => {
            capturedSql2 = result;
          },
        },
      );

      expect(capturedSql1).to.exist;
      expect(capturedSql1!.sql).to.equal(
        'SELECT * FROM "events" WHERE "start_date" = $(targetDate)',
      );
      expect(capturedSql1!.params.targetDate).to.be.instanceOf(Date);

      expect(capturedSql2).to.exist;
      expect(capturedSql2!.sql).to.equal(
        'SELECT * FROM "events" WHERE "start_date" = $(targetDate)',
      );
      expect(capturedSql2!.params.targetDate).to.be.instanceOf(Date);

      // Midnight won't match
      expect(resultsMidnight).to.have.length(0);

      // Exact time will match
      expect(resultsActual).to.have.length(1);
      expect(resultsActual[0]?.title).to.equal("Team Meeting");
    });

    it("should handle timestamp inequality with time precision", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      // This is midnight, but the actual event is at 10:00:00
      const targetDate = new Date("2024-01-20");

      const results = await executeSelect(
        db,
        schema,
        (ctx, params) => ctx.from("events").where((e) => e.start_date != params.targetDate),
        { targetDate },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "events" WHERE "start_date" != $(targetDate)',
      );
      expect(capturedSql!.params.targetDate).to.be.instanceOf(Date);

      // Returns ALL events because none match midnight exactly
      expect(results).to.have.length(5);
    });
  });

  describe("Comparison: DATE vs TIMESTAMP for date-only queries", () => {
    it("should show different behavior for 'find all on specific date'", async () => {
      let capturedSql1: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql2: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql3: { sql: string; params: Record<string, unknown> } | undefined;

      const searchDate = new Date("2024-01-15");

      // DATE column: Simple equality works
      const ordersOnDate = await executeSelect(
        db,
        schema,
        (ctx, params) => ctx.from("orders").where((o) => o.order_date == params.searchDate),
        { searchDate },
        {
          onSql: (result) => {
            capturedSql1 = result;
          },
        },
      );

      expect(capturedSql1).to.exist;
      expect(capturedSql1!.sql).to.equal(
        'SELECT * FROM "orders" WHERE "order_date" = $(searchDate)',
      );
      expect(capturedSql1!.params.searchDate).to.be.instanceOf(Date);

      expect(ordersOnDate).to.have.length(1);

      // TIMESTAMP column: Simple equality doesn't work (would need range)
      const eventsOnDate = await executeSelect(
        db,
        schema,
        (ctx, params) => ctx.from("events").where((e) => e.start_date == params.searchDate),
        { searchDate },
        {
          onSql: (result) => {
            capturedSql2 = result;
          },
        },
      );

      expect(capturedSql2).to.exist;
      expect(capturedSql2!.sql).to.equal(
        'SELECT * FROM "events" WHERE "start_date" = $(searchDate)',
      );
      expect(capturedSql2!.params.searchDate).to.be.instanceOf(Date);

      expect(eventsOnDate).to.have.length(0); // No match at midnight

      // TIMESTAMP column: Need range for date-only comparison
      const startOfDay = new Date("2024-01-15");
      const endOfDay = new Date("2024-01-16");
      const eventsInRange = await executeSelect(
        db,
        schema,
        (ctx, params) =>
          ctx
            .from("events")
            .where((e) => e.start_date >= params.startOfDay && e.start_date < params.endOfDay),
        { startOfDay, endOfDay },
        {
          onSql: (result) => {
            capturedSql3 = result;
          },
        },
      );

      expect(capturedSql3).to.exist;
      expect(capturedSql3!.sql).to.equal(
        'SELECT * FROM "events" WHERE ("start_date" >= $(startOfDay) AND "start_date" < $(endOfDay))',
      );
      expect(capturedSql3!.params.startOfDay).to.be.instanceOf(Date);
      expect(capturedSql3!.params.endOfDay).to.be.instanceOf(Date);

      expect(eventsInRange).to.have.length(1); // Team Meeting
    });
  });
});
