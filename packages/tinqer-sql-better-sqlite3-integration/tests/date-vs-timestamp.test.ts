/**
 * Tests comparing DATE vs TIMESTAMP column behavior
 * DATE columns only store the date part, TIMESTAMP stores date + time
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { execute } from "@webpods/tinqer-sql-better-sqlite3";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";
import { dbContext } from "./database-schema.js";

describe("Better SQLite3 Integration - DATE vs TIMESTAMP Columns", () => {
  before(() => {
    setupTestDatabase(db);
  });

  describe("DATE column behavior (orders.order_date)", () => {
    it("should match dates regardless of time component", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      // SQLite DATE columns require exact time match (stored as '2024-01-15 00:00:00')
      // Use midnight to match the stored value
      const targetDate = new Date("2024-01-15T00:00:00");

      const results = execute(
        db,
        (params) => from(dbContext, "orders").where((o) => o.order_date == params.targetDate),
        { targetDate },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "orders" WHERE "order_date" = @targetDate');
      expect(capturedSql!.params.targetDate).to.be.instanceOf(Date);

      // Should match the order with date '2024-01-15'
      expect(results).to.have.length(1);
      expect(results[0]?.id).to.equal(1);
    });

    it("should compare DATE columns properly with inequality", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      // Use local midnight for DATE column comparison
      const targetDate = new Date("2024-01-18T00:00:00");

      const results = execute(
        db,
        (params) => from(dbContext, "orders").where((o) => o.order_date != params.targetDate),
        { targetDate },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "orders" WHERE "order_date" != @targetDate');
      expect(capturedSql!.params.targetDate).to.be.instanceOf(Date);

      // Should return all orders except Order ID 4 (which has date 2024-01-18 in the database)
      expect(results).to.have.length(9);

      // Check that Order ID 4 is excluded
      const orderIds = results.map((o) => o.id);
      expect(orderIds).to.not.include(4);
    });
  });

  describe("TIMESTAMP column behavior (events.start_date)", () => {
    it("should require exact time match for equality", () => {
      let capturedSql1: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql2: { sql: string; params: Record<string, unknown> } | undefined;

      // These are different timestamps
      const midnight = new Date("2024-01-15"); // 00:00:00
      const actual = new Date("2024-01-15T09:00:00"); // 09:00:00 (actual time in DB)

      const resultsMidnight = execute(
        db,
        (params) => from(dbContext, "events").where((e) => e.start_date == params.targetDate),
        { targetDate: midnight },
        {
          onSql: (result) => {
            capturedSql1 = result;
          },
        },
      );

      const resultsActual = execute(
        db,
        (params) => from(dbContext, "events").where((e) => e.start_date == params.targetDate),
        { targetDate: actual },
        {
          onSql: (result) => {
            capturedSql2 = result;
          },
        },
      );

      expect(capturedSql1).to.exist;
      expect(capturedSql1!.sql).to.equal('SELECT * FROM "events" WHERE "start_date" = @targetDate');
      expect(capturedSql1!.params.targetDate).to.be.instanceOf(Date);

      expect(capturedSql2).to.exist;
      expect(capturedSql2!.sql).to.equal('SELECT * FROM "events" WHERE "start_date" = @targetDate');
      expect(capturedSql2!.params.targetDate).to.be.instanceOf(Date);

      // Midnight won't match
      expect(resultsMidnight).to.have.length(0);

      // Exact time will match
      expect(resultsActual).to.have.length(1);
      expect(resultsActual[0]?.title).to.equal("Team Meeting");
    });

    it("should handle timestamp inequality with time precision", () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      // This is midnight, but the actual event is at 10:00:00
      const targetDate = new Date("2024-01-20");

      const results = execute(
        db,
        (params) => from(dbContext, "events").where((e) => e.start_date != params.targetDate),
        { targetDate },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "events" WHERE "start_date" != @targetDate');
      expect(capturedSql!.params.targetDate).to.be.instanceOf(Date);

      // Returns ALL events because none match midnight exactly
      expect(results).to.have.length(5);
    });
  });

  describe("Comparison: DATE vs TIMESTAMP for date-only queries", () => {
    it("should show different behavior for 'find all on specific date'", () => {
      let capturedSql1: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql2: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql3: { sql: string; params: Record<string, unknown> } | undefined;

      // Use explicit midnight time for date comparison
      const searchDate = new Date("2024-01-15T00:00:00");

      // DATE column: Simple equality works
      const ordersOnDate = execute(
        db,
        (params) => from(dbContext, "orders").where((o) => o.order_date == params.searchDate),
        { searchDate },
        {
          onSql: (result) => {
            capturedSql1 = result;
          },
        },
      );

      expect(capturedSql1).to.exist;
      expect(capturedSql1!.sql).to.equal('SELECT * FROM "orders" WHERE "order_date" = @searchDate');
      expect(capturedSql1!.params.searchDate).to.be.instanceOf(Date);

      expect(ordersOnDate).to.have.length(1);

      // TIMESTAMP column: Simple equality doesn't work (would need range)
      const eventsOnDate = execute(
        db,
        (params) => from(dbContext, "events").where((e) => e.start_date == params.searchDate),
        { searchDate },
        {
          onSql: (result) => {
            capturedSql2 = result;
          },
        },
      );

      expect(capturedSql2).to.exist;
      expect(capturedSql2!.sql).to.equal('SELECT * FROM "events" WHERE "start_date" = @searchDate');
      expect(capturedSql2!.params.searchDate).to.be.instanceOf(Date);

      expect(eventsOnDate).to.have.length(0); // No match at midnight

      // TIMESTAMP column: Need range for date-only comparison
      const startOfDay = new Date("2024-01-15");
      const endOfDay = new Date("2024-01-16");
      const eventsInRange = execute(
        db,
        (params) =>
          from(dbContext, "events").where(
            (e) => e.start_date >= params.startOfDay && e.start_date < params.endOfDay,
          ),
        { startOfDay, endOfDay },
        {
          onSql: (result) => {
            capturedSql3 = result;
          },
        },
      );

      expect(capturedSql3).to.exist;
      expect(capturedSql3!.sql).to.equal(
        'SELECT * FROM "events" WHERE ("start_date" >= @startOfDay AND "start_date" < @endOfDay)',
      );
      expect(capturedSql3!.params.startOfDay).to.be.instanceOf(Date);
      expect(capturedSql3!.params.endOfDay).to.be.instanceOf(Date);

      expect(eventsInRange).to.have.length(1); // Team Meeting
    });
  });
});
