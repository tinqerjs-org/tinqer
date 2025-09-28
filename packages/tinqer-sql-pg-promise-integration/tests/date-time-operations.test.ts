/**
 * Date/Time Operations Integration Tests
 * Tests for date and time handling in queries with real PostgreSQL database.
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { execute, executeSimple } from "@webpods/tinqer-sql-pg-promise";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";
import { dbContext } from "./database-schema.js";

describe("PostgreSQL Integration - Date/Time Operations", () => {
  before(async () => {
    await setupTestDatabase(db);
  });

  describe("Date equality and inequality", () => {
    it("should handle date equality comparison", async () => {
      const targetDate = new Date("2024-01-15 09:00:00");
      const results = await execute(
        db,
        (params) => from(dbContext, "events").where((e) => e.start_date == params.targetDate),
        { targetDate },
      );

      expect(results).to.be.an("array");
      expect(results).to.have.length(1);
      if (results[0]) {
        expect(results[0].title).to.equal("Team Meeting");
      }
    });

    it("should handle date inequality comparisons", async () => {
      const targetDate = new Date("2024-01-20");
      const results = await execute(
        db,
        (params) => from(dbContext, "events").where((e) => e.start_date != params.targetDate),
        { targetDate },
      );

      expect(results).to.be.an("array");
      // Should return all events except the one on Jan 20
      expect(results.length).to.be.greaterThan(0);
      results.forEach((event) => {
        const eventDate = new Date(event.start_date);
        expect(eventDate.toDateString()).to.not.equal(targetDate.toDateString());
      });
    });

    it("should handle date greater than comparison", async () => {
      const cutoffDate = new Date("2024-01-18");
      const results = await execute(
        db,
        (params) => from(dbContext, "events").where((e) => e.start_date > params.cutoffDate),
        { cutoffDate },
      );

      expect(results).to.be.an("array");
      results.forEach((event) => {
        const eventDate = new Date(event.start_date);
        expect(eventDate.getTime()).to.be.greaterThan(cutoffDate.getTime());
      });
    });

    it("should handle date less than or equal comparison", async () => {
      const deadline = new Date("2024-01-20");
      const results = await execute(
        db,
        (params) => from(dbContext, "events").where((e) => e.start_date <= params.deadline),
        { deadline },
      );

      expect(results).to.be.an("array");
      results.forEach((event) => {
        const eventDate = new Date(event.start_date);
        expect(eventDate.getTime()).to.be.at.most(deadline.getTime());
      });
    });
  });

  describe("Date range queries", () => {
    it("should handle date range with AND", async () => {
      const startDate = new Date("2024-01-15");
      const endDate = new Date("2024-01-20");
      const results = await execute(
        db,
        (params) =>
          from(dbContext, "events").where(
            (e) => e.start_date >= params.startDate && e.start_date <= params.endDate,
          ),
        { startDate, endDate },
      );

      expect(results).to.be.an("array");
      expect(results).to.have.length.at.least(2);
      results.forEach((event) => {
        const eventDate = new Date(event.start_date);
        expect(eventDate.getTime()).to.be.at.least(startDate.getTime());
        expect(eventDate.getTime()).to.be.at.most(endDate.getTime());
      });
    });

    it("should handle exclusive date ranges", async () => {
      const startDate = new Date("2024-01-15");
      const endDate = new Date("2024-01-25");
      const results = await execute(
        db,
        (params) =>
          from(dbContext, "events").where(
            (e) => e.start_date > params.startDate && e.start_date < params.endDate,
          ),
        { startDate, endDate },
      );

      expect(results).to.be.an("array");
      results.forEach((event) => {
        const eventDate = new Date(event.start_date);
        expect(eventDate.getTime()).to.be.greaterThan(startDate.getTime());
        expect(eventDate.getTime()).to.be.lessThan(endDate.getTime());
      });
    });
  });

  describe("Date with NULL handling", () => {
    it("should handle NULL date checks with IS NULL", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "events").where((e) => e.updated_at == null),
      );

      expect(results).to.be.an("array");
      expect(results).to.have.length.at.least(2); // Some events have NULL updated_at
      results.forEach((event) => {
        expect(event.updated_at).to.be.null;
      });
    });

    it("should handle NULL date checks with IS NOT NULL", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "events").where((e) => e.updated_at != null),
      );

      expect(results).to.be.an("array");
      expect(results).to.have.length.at.least(3); // Some events have updated_at
      results.forEach((event) => {
        expect(event.updated_at).to.not.be.null;
      });
    });

    it("should handle date comparison with NULL coalescing", async () => {
      const defaultDate = new Date("1970-01-01");
      const cutoffDate = new Date("2024-01-15");
      const results = await execute(
        db,
        (params) =>
          from(dbContext, "events").where(
            (e) => (e.updated_at ?? params.defaultDate) > params.cutoffDate,
          ),
        { defaultDate, cutoffDate },
      );

      expect(results).to.be.an("array");
      // Events with updated_at > cutoff or NULL (which becomes 1970)
    });
  });

  describe("Date in ORDER BY", () => {
    it("should order by date ascending", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "events").orderBy((e) => e.start_date),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(2);

      // Verify ordering
      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1];
        const curr = results[i];
        if (prev && curr) {
          const prevDate = new Date(prev.start_date);
          const currDate = new Date(curr.start_date);
          expect(prevDate.getTime()).to.be.at.most(currDate.getTime());
        }
      }
    });

    it("should order by date descending", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "events").orderByDescending((e) => e.start_date),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(2);

      // Verify descending order
      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1];
        const curr = results[i];
        if (prev && curr) {
          const prevDate = new Date(prev.start_date);
          const currDate = new Date(curr.start_date);
          expect(prevDate.getTime()).to.be.at.least(currDate.getTime());
        }
      }
    });

    it("should order with NULL dates using COALESCE", async () => {
      const defaultDate = new Date("1970-01-01");
      const results = await executeSimple(db, () =>
        from(dbContext, "events").orderBy((e) => e.updated_at ?? defaultDate),
      );

      expect(results).to.be.an("array");
      // NULL dates should appear first (as 1970-01-01)
      if (results[0] && results[0].updated_at === null) {
        expect(results[0].updated_at).to.be.null;
      }
    });
  });

  describe("Date in SELECT projections", () => {
    it("should select date fields", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "events").select((e) => ({
          eventTitle: e.title,
          eventDate: e.start_date,
          lastUpdate: e.updated_at,
        })),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      if (results[0]) {
        expect(results[0]).to.have.property("eventTitle");
        expect(results[0]).to.have.property("eventDate");
        expect(results[0]).to.have.property("lastUpdate");
      }
    });

    it("should select dates with NULL coalescing", async () => {
      const defaultDate = new Date("2024-01-01");
      const results = await executeSimple(db, () =>
        from(dbContext, "events").select((e) => ({
          title: e.title,
          lastUpdate: e.updated_at ?? defaultDate,
        })),
      );

      expect(results).to.be.an("array");
      results.forEach((result) => {
        expect(result.lastUpdate).to.not.be.undefined;
        // Either original date or default date
      });
    });
  });

  describe("Date arithmetic patterns", () => {
    it("should handle relative date comparisons", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const results = await executeSimple(db, () =>
        from(dbContext, "orders").where(
          (o) => o.order_date >= thirtyDaysAgo && o.order_date <= today,
        ),
      );

      expect(results).to.be.an("array");
      // Should include recent orders
    });

    it("should find events in the next week", async () => {
      const today = new Date("2024-01-15"); // Use fixed date for predictable results
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);

      const results = await executeSimple(db, () =>
        from(dbContext, "events").where((e) => e.start_date >= today && e.start_date <= nextWeek),
      );

      expect(results).to.be.an("array");
      expect(results).to.have.length.at.least(2); // Team Meeting and Client Call
    });
  });

  describe("Date edge cases", () => {
    it("should handle leap year dates", async () => {
      const leapDay = new Date("2024-02-29");
      const results = await executeSimple(db, () =>
        from(dbContext, "events").where((e) => e.start_date == leapDay),
      );

      expect(results).to.be.an("array");
      expect(results).to.have.length(0); // No events on leap day in test data
    });

    it("should handle year boundaries", async () => {
      const newYearsEve = new Date("2023-12-31T23:59:59.999Z");
      const newYearsDay = new Date("2024-01-01T00:00:00.000Z");
      const results = await executeSimple(db, () =>
        from(dbContext, "events").where(
          (e) => e.start_date > newYearsEve && e.start_date >= newYearsDay,
        ),
      );

      expect(results).to.be.an("array");
      expect(results).to.have.length(5); // All test events are in 2024
    });

    it("should handle very old dates", async () => {
      const historicalDate = new Date("1900-01-01");
      const results = await executeSimple(db, () =>
        from(dbContext, "events").where((e) => e.start_date >= historicalDate),
      );

      expect(results).to.be.an("array");
      expect(results).to.have.length(5); // All events are after 1900
    });

    it("should handle future dates", async () => {
      const futureDate = new Date("2099-12-31");
      const results = await executeSimple(db, () =>
        from(dbContext, "events").where((e) => e.start_date <= futureDate),
      );

      expect(results).to.be.an("array");
      expect(results).to.have.length(5); // All events are before 2099
    });
  });

  describe("Complex date queries", () => {
    it("should handle multiple date conditions with OR", async () => {
      const date1 = new Date("2024-01-15");
      const date2 = new Date("2024-02-01");
      const results = await executeSimple(db, () =>
        from(dbContext, "events").where((e) => e.start_date == date1 || e.start_date == date2),
      );

      expect(results).to.be.an("array");
      expect(results).to.have.length(2); // Team Meeting and Product Launch
    });

    it("should handle nested date conditions", async () => {
      const date1 = new Date("2024-01-01");
      const date2 = new Date("2024-01-20");
      const date3 = new Date("2024-01-25");
      const results = await executeSimple(db, () =>
        from(dbContext, "events").where(
          (e) => (e.start_date >= date1 && e.start_date <= date2) || e.start_date > date3,
        ),
      );

      expect(results).to.be.an("array");
      expect(results).to.have.length.at.least(4);
    });

    it("should filter by date and other conditions", async () => {
      const cutoffDate = new Date("2024-01-16");
      const results = await executeSimple(db, () =>
        from(dbContext, "events").where(
          (e) => e.start_date >= cutoffDate && e.is_recurring == true,
        ),
      );

      expect(results).to.be.an("array");
      expect(results).to.have.length(1); // Only Sprint Review
      if (results[0]) {
        expect(results[0].title).to.equal("Sprint Review");
      }
    });
  });

  describe("Date grouping and aggregation", () => {
    it("should group orders by date", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "orders")
          .groupBy((o) => o.order_date)
          .select((g) => ({
            date: g.key,
            count: g.count(),
            totalAmount: g.sum((o) => o.total_amount),
          })),
      );

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((result) => {
        expect(result).to.have.property("date");
        expect(result).to.have.property("count");
        expect(result).to.have.property("totalAmount");
      });
    });

    it("should find min and max dates", async () => {
      const results = await executeSimple(db, () =>
        from(dbContext, "events")
          .groupBy(() => 1) // Group all into one
          .select((g) => ({
            earliest: g.min((e) => e.start_date),
            latest: g.max((e) => e.start_date),
            count: g.count(),
          })),
      );

      expect(results).to.be.an("array");
      expect(results).to.have.length(1);
      if (results[0]) {
        expect(results[0].count).to.equal(5);
      }
      // earliest should be Team Meeting, latest should be Product Launch
    });
  });
});
