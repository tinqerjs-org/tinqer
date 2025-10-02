/**
 * Date/Time Operations Integration Tests
 * Tests for date and time handling in queries with real PostgreSQL database.
 */

import { describe, it, before } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { executeSelect, executeSelectSimple } from "@webpods/tinqer-sql-pg-promise";
import { setupTestDatabase } from "./test-setup.js";
import { db } from "./shared-db.js";
import { dbContext } from "./database-schema.js";

describe("PostgreSQL Integration - Date/Time Operations", () => {
  before(async () => {
    await setupTestDatabase(db);
  });

  describe("Date equality and inequality", () => {
    it("should handle date equality comparison", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const targetDate = new Date("2024-01-15 09:00:00");
      const results = await executeSelect(
        db,
        (params) => from(dbContext, "events").where((e) => e.start_date == params.targetDate),
        { targetDate },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "events" WHERE "start_date" = $(targetDate)',
      );
      expect(capturedSql!.params.targetDate).to.be.instanceOf(Date);

      expect(results).to.be.an("array");
      expect(results).to.have.length(1);
      if (results[0]) {
        expect(results[0].title).to.equal("Team Meeting");
      }
    });

    it("should handle date inequality comparisons", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      // Use the exact timestamp that exists in the database
      const targetDate = new Date("2024-01-20 10:00:00");
      const results = await executeSelect(
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
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "events" WHERE "start_date" != $(targetDate)',
      );
      expect(capturedSql!.params.targetDate).to.be.instanceOf(Date);

      expect(results).to.be.an("array");
      // Should return all events except Training Session
      expect(results).to.have.length(4);
      results.forEach((event) => {
        expect(event.title).to.not.equal("Training Session");
      });
    });

    it("should handle date greater than comparison", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const cutoffDate = new Date("2024-01-18");
      const results = await executeSelect(
        db,
        (params) => from(dbContext, "events").where((e) => e.start_date > params.cutoffDate),
        { cutoffDate },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "events" WHERE "start_date" > $(cutoffDate)',
      );
      expect(capturedSql!.params.cutoffDate).to.be.instanceOf(Date);

      expect(results).to.be.an("array");
      results.forEach((event) => {
        const eventDate = new Date(event.start_date);
        expect(eventDate.getTime()).to.be.greaterThan(cutoffDate.getTime());
      });
    });

    it("should handle date less than or equal comparison", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const deadline = new Date("2024-01-20");
      const results = await executeSelect(
        db,
        (params) => from(dbContext, "events").where((e) => e.start_date <= params.deadline),
        { deadline },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "events" WHERE "start_date" <= $(deadline)');
      expect(capturedSql!.params.deadline).to.be.instanceOf(Date);

      expect(results).to.be.an("array");
      results.forEach((event) => {
        const eventDate = new Date(event.start_date);
        expect(eventDate.getTime()).to.be.at.most(deadline.getTime());
      });
    });
  });

  describe("Date range queries", () => {
    it("should handle date range with AND", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const startDate = new Date("2024-01-15");
      const endDate = new Date("2024-01-20");
      const results = await executeSelect(
        db,
        (params) =>
          from(dbContext, "events").where(
            (e) => e.start_date >= params.startDate && e.start_date <= params.endDate,
          ),
        { startDate, endDate },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "events" WHERE ("start_date" >= $(startDate) AND "start_date" <= $(endDate))',
      );
      expect(capturedSql!.params.startDate).to.be.instanceOf(Date);
      expect(capturedSql!.params.endDate).to.be.instanceOf(Date);

      expect(results).to.be.an("array");
      expect(results).to.have.length.at.least(2);
      results.forEach((event) => {
        const eventDate = new Date(event.start_date);
        expect(eventDate.getTime()).to.be.at.least(startDate.getTime());
        expect(eventDate.getTime()).to.be.at.most(endDate.getTime());
      });
    });

    it("should handle exclusive date ranges", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const startDate = new Date("2024-01-15");
      const endDate = new Date("2024-01-25");
      const results = await executeSelect(
        db,
        (params) =>
          from(dbContext, "events").where(
            (e) => e.start_date > params.startDate && e.start_date < params.endDate,
          ),
        { startDate, endDate },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "events" WHERE ("start_date" > $(startDate) AND "start_date" < $(endDate))',
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
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        () => from(dbContext, "events").where((e) => e.updated_at == null),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "events" WHERE "updated_at" IS NULL');

      expect(results).to.be.an("array");
      expect(results).to.have.length.at.least(2); // Some events have NULL updated_at
      results.forEach((event) => {
        expect(event.updated_at).to.be.null;
      });
    });

    it("should handle NULL date checks with IS NOT NULL", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        () => from(dbContext, "events").where((e) => e.updated_at != null),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "events" WHERE "updated_at" IS NOT NULL');

      expect(results).to.be.an("array");
      expect(results).to.have.length.at.least(3); // Some events have updated_at
      results.forEach((event) => {
        expect(event.updated_at).to.not.be.null;
      });
    });

    it("should handle date comparison with NULL coalescing", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const defaultDate = new Date("1970-01-01");
      const cutoffDate = new Date("2024-01-15");
      const results = await executeSelect(
        db,
        (params) =>
          from(dbContext, "events").where(
            (e) => (e.updated_at ?? params.defaultDate) > params.cutoffDate,
          ),
        { defaultDate, cutoffDate },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "events" WHERE COALESCE("updated_at", $(defaultDate)) > $(cutoffDate)',
      );

      expect(results).to.be.an("array");
      // Events with updated_at > cutoff or NULL (which becomes 1970)
    });
  });

  describe("Date in ORDER BY", () => {
    it("should order by date ascending", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        () => from(dbContext, "events").orderBy((e) => e.start_date),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "events" ORDER BY "start_date" ASC');

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
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        () => from(dbContext, "events").orderByDescending((e) => e.start_date),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "events" ORDER BY "start_date" DESC');

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
  });

  describe("Date in SELECT projections", () => {
    it("should select date fields", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        () =>
          from(dbContext, "events").select((e) => ({
            eventTitle: e.title,
            eventDate: e.start_date,
            lastUpdate: e.updated_at,
          })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "title" AS "eventTitle", "start_date" AS "eventDate", "updated_at" AS "lastUpdate" FROM "events"',
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
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const defaultDate = new Date("2024-01-01");
      const results = await executeSelect(
        db,
        (params) =>
          from(dbContext, "events").select((e) => ({
            title: e.title,
            lastUpdate: e.updated_at ?? params.defaultDate,
          })),
        { defaultDate },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "title" AS "title", COALESCE("updated_at", $(defaultDate)) AS "lastUpdate" FROM "events"',
      );

      expect(results).to.be.an("array");
      results.forEach((result) => {
        expect(result.lastUpdate).to.not.be.undefined;
        // Either original date or default date
      });
    });
  });

  describe("DATE column operations (orders.order_date)", () => {
    it("should handle DATE equality with any time component", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      // DATE columns ignore time - any time on Jan 15 matches
      const dateWithTime = new Date("2024-01-15T23:59:59");
      const results = await executeSelect(
        db,
        (params) => from(dbContext, "orders").where((o) => o.order_date == params.targetDate),
        { targetDate: dateWithTime },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "orders" WHERE "order_date" = $(targetDate)',
      );
      expect(capturedSql!.params.targetDate).to.be.instanceOf(Date);

      expect(results).to.have.length(1);
      expect(results[0]?.id).to.equal(1);
    });

    it("should handle DATE greater than", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const cutoffDate = new Date("2024-01-20");
      const results = await executeSelect(
        db,
        (params) => from(dbContext, "orders").where((o) => o.order_date > params.cutoffDate),
        { cutoffDate },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "orders" WHERE "order_date" > $(cutoffDate)',
      );
      expect(capturedSql!.params.cutoffDate).to.be.instanceOf(Date);

      expect(results).to.have.length(4); // Orders 7-10 (Jan 21-24)
    });

    it("should handle DATE less than or equal", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const maxDate = new Date("2024-01-18");
      const results = await executeSelect(
        db,
        (params) => from(dbContext, "orders").where((o) => o.order_date <= params.maxDate),
        { maxDate },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "orders" WHERE "order_date" <= $(maxDate)');
      expect(capturedSql!.params.maxDate).to.be.instanceOf(Date);

      expect(results).to.have.length(4); // Orders 1-4
    });

    it("should handle DATE in ORDER BY", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        () =>
          from(dbContext, "orders")
            .orderByDescending((o) => o.order_date)
            .take(3),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "orders" ORDER BY "order_date" DESC LIMIT $(__p1)',
      );
      expect(capturedSql!.params).to.deep.equal({ __p1: 3 });

      expect(results).to.have.length(3);
      // Should be Jan 24, 23, 22 in that order
      expect(results[0]?.id).to.equal(10);
      expect(results[1]?.id).to.equal(9);
      expect(results[2]?.id).to.equal(8);
    });

    it("should handle DATE in GROUP BY", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        () =>
          from(dbContext, "orders")
            .groupBy((o) => o.order_date)
            .select((g) => ({
              date: g.key,
              orderCount: g.count(),
            }))
            .orderBy((r) => r.date),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "order_date" AS "date", COUNT(*) AS "orderCount" FROM "orders" GROUP BY "order_date" ORDER BY "date" ASC',
      );
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.have.length(10); // 10 distinct dates
      results.forEach((r) => {
        expect(r.orderCount).to.equal(1); // Each date has 1 order
      });
    });

    it("should handle NULL DATE values", async () => {
      let capturedSql1: { sql: string; params: Record<string, unknown> } | undefined;
      let capturedSql2: { sql: string; params: Record<string, unknown> } | undefined;

      // accounts.last_transaction_date can be NULL
      const nullResults = await executeSelectSimple(
        db,
        () => from(dbContext, "accounts").where((a) => a.last_transaction_date == null),
        {
          onSql: (result) => {
            capturedSql1 = result;
          },
        },
      );

      expect(capturedSql1).to.exist;
      expect(capturedSql1!.sql).to.equal(
        'SELECT * FROM "accounts" WHERE "last_transaction_date" IS NULL',
      );
      expect(capturedSql1!.params).to.deep.equal({});

      expect(nullResults).to.have.length(1); // Account 3 has NULL date

      const notNullResults = await executeSelectSimple(
        db,
        () => from(dbContext, "accounts").where((a) => a.last_transaction_date != null),
        {
          onSql: (result) => {
            capturedSql2 = result;
          },
        },
      );

      expect(capturedSql2).to.exist;
      expect(capturedSql2!.sql).to.equal(
        'SELECT * FROM "accounts" WHERE "last_transaction_date" IS NOT NULL',
      );
      expect(capturedSql2!.params).to.deep.equal({});

      expect(notNullResults).to.have.length(4);
    });

    it("should handle DATE with NULL coalescing", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const defaultDate = new Date("2000-01-01");
      const results = await executeSelect(
        db,
        (params) =>
          from(dbContext, "accounts").where(
            (a) => (a.last_transaction_date ?? params.defaultDate) < params.cutoff,
          ),
        { defaultDate, cutoff: new Date("2024-01-18") },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "accounts" WHERE COALESCE("last_transaction_date", $(defaultDate)) < $(cutoff)',
      );
      expect(capturedSql!.params.defaultDate).to.be.instanceOf(Date);
      expect(capturedSql!.params.cutoff).to.be.instanceOf(Date);

      // Account 3 (NULL becomes 2000-01-01) and Account 5 (2024-01-17)
      expect(results).to.have.length(2);
    });
  });

  describe("Date arithmetic patterns", () => {
    it("should find events in the next week", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const today = new Date("2024-01-15"); // Use fixed date for predictable results
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);

      const results = await executeSelect(
        db,
        (params) =>
          from(dbContext, "events").where(
            (e) => e.start_date >= params.today && e.start_date <= params.nextWeek,
          ),
        { today, nextWeek },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "events" WHERE ("start_date" >= $(today) AND "start_date" <= $(nextWeek))',
      );
      expect(capturedSql!.params.today).to.be.instanceOf(Date);
      expect(capturedSql!.params.nextWeek).to.be.instanceOf(Date);

      expect(results).to.be.an("array");
      expect(results).to.have.length.at.least(2); // Team Meeting and Client Call
    });
  });

  describe("Date edge cases", () => {
    it("should handle leap year dates", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const leapDay = new Date("2024-02-29");
      const results = await executeSelect(
        db,
        (params) => from(dbContext, "events").where((e) => e.start_date == params.leapDay),
        { leapDay },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal('SELECT * FROM "events" WHERE "start_date" = $(leapDay)');
      expect(capturedSql!.params.leapDay).to.be.instanceOf(Date);

      expect(results).to.be.an("array");
      expect(results).to.have.length(0); // No events on leap day in test data
    });

    it("should handle year boundaries", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const newYearsEve = new Date("2023-12-31T23:59:59.999Z");
      const newYearsDay = new Date("2024-01-01T00:00:00.000Z");
      const results = await executeSelect(
        db,
        (params) =>
          from(dbContext, "events").where(
            (e) => e.start_date > params.newYearsEve && e.start_date >= params.newYearsDay,
          ),
        { newYearsEve, newYearsDay },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "events" WHERE ("start_date" > $(newYearsEve) AND "start_date" >= $(newYearsDay))',
      );
      expect(capturedSql!.params.newYearsEve).to.be.instanceOf(Date);
      expect(capturedSql!.params.newYearsDay).to.be.instanceOf(Date);

      expect(results).to.be.an("array");
      expect(results).to.have.length(5); // All test events are in 2024
    });

    it("should handle very old dates", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const historicalDate = new Date("1900-01-01");
      const results = await executeSelect(
        db,
        (params) => from(dbContext, "events").where((e) => e.start_date >= params.historicalDate),
        { historicalDate },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "events" WHERE "start_date" >= $(historicalDate)',
      );
      expect(capturedSql!.params.historicalDate).to.be.instanceOf(Date);

      expect(results).to.be.an("array");
      expect(results).to.have.length(5); // All events are after 1900
    });

    it("should handle future dates", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const futureDate = new Date("2099-12-31");
      const results = await executeSelect(
        db,
        (params) => from(dbContext, "events").where((e) => e.start_date <= params.futureDate),
        { futureDate },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "events" WHERE "start_date" <= $(futureDate)',
      );
      expect(capturedSql!.params.futureDate).to.be.instanceOf(Date);

      expect(results).to.be.an("array");
      expect(results).to.have.length(5); // All events are before 2099
    });
  });

  describe("Complex date queries", () => {
    it("should handle multiple date conditions with OR", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      // Use exact timestamps that match the database
      const date1 = new Date("2024-01-15 09:00:00");
      const date2 = new Date("2024-02-01 14:00:00");
      const results = await executeSelect(
        db,
        (params) =>
          from(dbContext, "events").where(
            (e) => e.start_date == params.date1 || e.start_date == params.date2,
          ),
        { date1, date2 },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "events" WHERE ("start_date" = $(date1) OR "start_date" = $(date2))',
      );
      expect(capturedSql!.params.date1).to.be.instanceOf(Date);
      expect(capturedSql!.params.date2).to.be.instanceOf(Date);

      expect(results).to.be.an("array");
      expect(results).to.have.length(2); // Team Meeting and Product Launch
    });

    it("should handle nested date conditions", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const date1 = new Date("2024-01-01");
      const date2 = new Date("2024-01-20");
      const date3 = new Date("2024-01-25");
      const results = await executeSelect(
        db,
        (params) =>
          from(dbContext, "events").where(
            (e) =>
              (e.start_date >= params.date1 && e.start_date <= params.date2) ||
              e.start_date > params.date3,
          ),
        { date1, date2, date3 },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "events" WHERE (("start_date" >= $(date1) AND "start_date" <= $(date2)) OR "start_date" > $(date3))',
      );
      expect(capturedSql!.params.date1).to.be.instanceOf(Date);
      expect(capturedSql!.params.date2).to.be.instanceOf(Date);
      expect(capturedSql!.params.date3).to.be.instanceOf(Date);

      expect(results).to.be.an("array");
      expect(results).to.have.length.at.least(4);
    });

    it("should filter by date and other conditions", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const cutoffDate = new Date("2024-01-16");
      const results = await executeSelect(
        db,
        (params) =>
          from(dbContext, "events").where(
            (e) => e.start_date >= params.cutoffDate && e.is_recurring == true,
          ),
        { cutoffDate },
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT * FROM "events" WHERE ("start_date" >= $(cutoffDate) AND "is_recurring" = $(__p1))',
      );
      expect(capturedSql!.params.cutoffDate).to.be.instanceOf(Date);
      expect(capturedSql!.params.__p1).to.equal(true);

      expect(results).to.be.an("array");
      expect(results).to.have.length(1); // Only Sprint Review
      if (results[0]) {
        expect(results[0].title).to.equal("Sprint Review");
      }
    });
  });

  describe("Date grouping and aggregation", () => {
    it("should group orders by date", async () => {
      let capturedSql: { sql: string; params: Record<string, unknown> } | undefined;

      const results = await executeSelectSimple(
        db,
        () =>
          from(dbContext, "orders")
            .groupBy((o) => o.order_date)
            .select((g) => ({
              date: g.key,
              count: g.count(),
              totalAmount: g.sum((o) => o.total_amount),
            })),
        {
          onSql: (result) => {
            capturedSql = result;
          },
        },
      );

      expect(capturedSql).to.exist;
      expect(capturedSql!.sql).to.equal(
        'SELECT "order_date" AS "date", COUNT(*) AS "count", SUM("total_amount") AS "totalAmount" FROM "orders" GROUP BY "order_date"',
      );
      expect(capturedSql!.params).to.deep.equal({});

      expect(results).to.be.an("array");
      expect(results.length).to.be.greaterThan(0);
      results.forEach((result) => {
        expect(result).to.have.property("date");
        expect(result).to.have.property("count");
        expect(result).to.have.property("totalAmount");
      });
    });

    it("should find min and max dates", async () => {
      // Get aggregates without GROUP BY (aggregates entire table)
      const result = await db.one(`
        SELECT
          MIN(start_date) as earliest,
          MAX(start_date) as latest,
          COUNT(*) as count
        FROM events
      `);

      expect(result.count).to.equal(5);
      expect(new Date(result.earliest).toISOString()).to.include("2024-01-15");
      expect(new Date(result.latest).toISOString()).to.include("2024-02-01");
    });
  });
});
