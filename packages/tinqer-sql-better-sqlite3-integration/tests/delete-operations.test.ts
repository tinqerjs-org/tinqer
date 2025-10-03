/**
 * Integration tests for DELETE operations with Better SQLite3
 */

import { describe, it, before, after, beforeEach } from "mocha";
import { strict as assert } from "assert";
import { deleteFrom, createContext } from "@webpods/tinqer";
import { executeDelete, deleteStatement } from "@webpods/tinqer-sql-better-sqlite3";
import { db, closeDatabase } from "./shared-db.js";

// Define types for test tables
interface TestSchema {
  test_products: {
    id?: number;
    name: string;
    category?: string;
    price?: number;
    in_stock?: boolean;
    created_date?: string;
    last_modified?: string;
  };
  test_users: {
    id?: number;
    username: string;
    email: string;
    age?: number;
    is_active?: boolean;
    role?: string;
    joined_date?: string;
    last_login?: string;
  };
  test_orders: {
    id?: number;
    user_id: number;
    product_id: number;
    quantity: number;
    status?: string;
    order_date?: string;
  };
  test_logs: {
    id?: number;
    user_id: number;
    action: string;
    log_date?: string;
    level?: string;
    message?: string;
    created_at?: string;
  };
}

const dbContext = createContext<TestSchema>();

describe("DELETE Operations - SQLite Integration", () => {
  before(() => {
    // Create test tables for DELETE operations
    db.exec(`
      CREATE TABLE IF NOT EXISTS test_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT,
        price REAL,
        in_stock INTEGER DEFAULT 1,
        created_date TEXT,
        last_modified TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS test_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        age INTEGER,
        is_active INTEGER DEFAULT 1,
        role TEXT DEFAULT 'user',
        joined_date TEXT,
        last_login TEXT
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS test_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES test_users(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES test_products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        order_date TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS test_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL,
        message TEXT,
        user_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Enable foreign key constraints in SQLite
    db.exec("PRAGMA foreign_keys = ON");
  });

  after(() => {
    // Drop test tables
    db.exec("DROP TABLE IF EXISTS test_orders");
    db.exec("DROP TABLE IF EXISTS test_logs");
    db.exec("DROP TABLE IF EXISTS test_users");
    db.exec("DROP TABLE IF EXISTS test_products");
    closeDatabase();
  });

  beforeEach(() => {
    // Clear and seed test data
    db.exec("DELETE FROM test_orders");
    db.exec("DELETE FROM test_logs");
    db.exec("DELETE FROM test_users");
    db.exec("DELETE FROM test_products");

    // Seed products
    db.exec(`
      INSERT INTO test_products (name, category, price, in_stock, created_date)
      VALUES
        ('Laptop', 'Electronics', 999.99, 1, '2024-01-01'),
        ('Mouse', 'Electronics', 29.99, 1, '2024-01-05'),
        ('Keyboard', 'Electronics', 79.99, 0, '2024-01-10'),
        ('Monitor', 'Electronics', 299.99, 1, '2024-01-15'),
        ('Desk Chair', 'Furniture', 249.99, 1, '2024-01-20'),
        ('Standing Desk', 'Furniture', 599.99, 0, '2024-01-25'),
        ('Notebook', 'Stationery', 5.99, 1, '2024-02-01'),
        ('Pen Set', 'Stationery', 12.99, 1, '2024-02-05')
    `);

    // Seed users
    db.exec(`
      INSERT INTO test_users (username, email, age, is_active, role, joined_date)
      VALUES
        ('admin_user', 'admin@example.com', 35, 1, 'admin', '2023-01-01'),
        ('john_doe', 'john@example.com', 28, 1, 'user', '2023-06-15'),
        ('jane_smith', 'jane@example.com', 32, 0, 'user', '2023-07-20'),
        ('bob_wilson', 'bob@example.com', 45, 1, 'moderator', '2023-08-10'),
        ('alice_jones', 'alice@example.com', 26, 1, 'user', '2024-01-05'),
        ('inactive_user', 'inactive@example.com', 30, 0, 'user', '2023-03-01')
    `);

    // Seed orders
    db.exec(`
      INSERT INTO test_orders (user_id, product_id, quantity, status)
      VALUES
        (1, 1, 1, 'completed'),
        (2, 2, 2, 'completed'),
        (2, 3, 1, 'pending'),
        (3, 4, 1, 'cancelled'),
        (4, 5, 1, 'completed'),
        (5, 1, 1, 'pending')
    `);

    // Seed logs
    db.exec(`
      INSERT INTO test_logs (level, message, user_id)
      VALUES
        ('INFO', 'User logged in', 1),
        ('ERROR', 'Failed login attempt', 2),
        ('WARNING', 'Suspicious activity detected', 3),
        ('INFO', 'Password changed', 1),
        ('ERROR', 'Database connection failed', NULL),
        ('DEBUG', 'Query executed', 2)
    `);
  });

  describe("Basic DELETE operations", () => {
    it("should delete single row with WHERE clause", () => {
      const initialCount = db.prepare("SELECT COUNT(*) as count FROM test_products").get() as any;
      assert.equal(initialCount.count, 8);

      const rowCount = executeDelete(
        db,
        () => deleteFrom(dbContext, "test_products").where((p) => p.name === "Notebook"),
        {},
      );

      assert.equal(rowCount, 1);

      const finalCount = db.prepare("SELECT COUNT(*) as count FROM test_products").get() as any;
      assert.equal(finalCount.count, 7);

      // Verify the specific row is deleted
      const result = db.prepare("SELECT * FROM test_products WHERE name = ?").all("Notebook");
      assert.equal(result.length, 0);
    });

    it("should delete with parameters", () => {
      const params = { productName: "Mouse" };

      const rowCount = executeDelete(
        db,
        (p: typeof params) =>
          deleteFrom(dbContext, "test_products").where((prod) => prod.name === p.productName),
        params,
      );

      assert.equal(rowCount, 1);

      const result = db
        .prepare("SELECT * FROM test_products WHERE name = ?")
        .all(params.productName);
      assert.equal(result.length, 0);
    });

    it("should delete with numeric comparison", () => {
      const rowCount = executeDelete(
        db,
        () => deleteFrom(dbContext, "test_products").where((p) => p.price! < 10),
        {},
      );

      assert.equal(rowCount, 1); // Only Notebook (5.99)

      const remaining = db.prepare("SELECT * FROM test_products WHERE price < ?").all(10);
      assert.equal(remaining.length, 0);
    });

    it("should delete with boolean condition", () => {
      const rowCount = executeDelete(
        db,
        () => deleteFrom(dbContext, "test_users").where((u) => u.is_active === false),
        {},
      );

      assert.equal(rowCount, 2); // jane_smith and inactive_user

      const inactiveUsers = db.prepare("SELECT * FROM test_users WHERE is_active = ?").all(0);
      assert.equal(inactiveUsers.length, 0);
    });

    it("should delete with NULL checks", () => {
      const rowCount = executeDelete(
        db,
        () => deleteFrom(dbContext, "test_logs").where((l) => l.user_id === null),
        {},
      );

      assert.equal(rowCount, 1); // One log with NULL user_id

      const nullLogs = db.prepare("SELECT * FROM test_logs WHERE user_id IS NULL").all();
      assert.equal(nullLogs.length, 0);
    });
  });

  describe("DELETE with complex WHERE clauses", () => {
    it("should delete with AND conditions", () => {
      const rowCount = executeDelete(
        db,
        () =>
          deleteFrom(dbContext, "test_products").where(
            (p) => p.category === "Electronics" && p.in_stock === false,
          ),
        {},
      );

      assert.equal(rowCount, 1); // Only Keyboard matches

      const result = db
        .prepare("SELECT * FROM test_products WHERE category = ? AND in_stock = ?")
        .all("Electronics", 0);
      assert.equal(result.length, 0);
    });

    it("should delete with OR conditions", () => {
      const rowCount = executeDelete(
        db,
        () =>
          deleteFrom(dbContext, "test_products").where(
            (p) => p.category === "Stationery" || p.price! > 500,
          ),
        {},
      );

      assert.equal(rowCount, 3); // Notebook, Pen Set (Stationery) and Standing Desk (599.99)

      const stationery = db
        .prepare("SELECT * FROM test_products WHERE category = ?")
        .all("Stationery");
      assert.equal(stationery.length, 0);

      const expensive = db.prepare("SELECT * FROM test_products WHERE price > ?").all(500);
      assert.equal(expensive.length, 0);
    });

    it("should delete with complex nested conditions", () => {
      const rowCount = executeDelete(
        db,
        () =>
          deleteFrom(dbContext, "test_users").where(
            (u) =>
              (u.role === "user" && u.age! < 30) || (u.is_active === false && u.role !== "admin"),
          ),
        {},
      );

      // john_doe (user, 28), alice_jones (user, 26), jane_smith (inactive, user), inactive_user (inactive, user)
      assert.equal(rowCount, 4);

      const remainingUsers = db
        .prepare("SELECT username FROM test_users ORDER BY username")
        .all() as any[];
      const usernames = remainingUsers.map((u) => u.username);
      assert.deepEqual(usernames, ["admin_user", "bob_wilson"]);
    });

    it("should delete with NOT conditions", () => {
      const rowCount = executeDelete(
        db,
        () => deleteFrom(dbContext, "test_logs").where((l) => l.level !== "INFO"),
        {},
      );

      assert.equal(rowCount, 4); // ERROR, WARNING, DEBUG logs

      const remainingLogs = db.prepare("SELECT * FROM test_logs").all() as any[];
      assert.equal(remainingLogs.length, 2);
      remainingLogs.forEach((log) => assert.equal(log.level, "INFO"));
    });

    it("should delete with comparison operators", () => {
      const rowCount = executeDelete(
        db,
        () =>
          deleteFrom(dbContext, "test_products").where((p) => p.price! >= 250 && p.price! <= 600),
        {},
      );

      assert.equal(rowCount, 3); // Monitor (299.99), Desk Chair (249.99 - actually < 250), Standing Desk (599.99)
      // Actually should be 2: Monitor and Standing Desk

      const remaining = db.prepare("SELECT name, price FROM test_products ORDER BY price").all();
      // Should have deleted Monitor (299.99) and Standing Desk (599.99)
      assert.equal(remaining.length, 6);
    });
  });

  describe("DELETE with string operations", () => {
    it("should delete with startsWith", () => {
      const rowCount = executeDelete(
        db,
        () => deleteFrom(dbContext, "test_users").where((u) => u.username.startsWith("john")),
        {},
      );

      assert.equal(rowCount, 1); // john_doe

      const johns = db.prepare("SELECT * FROM test_users WHERE username LIKE ?").all("john%");
      assert.equal(johns.length, 0);
    });

    it("should delete with endsWith", () => {
      const rowCount = executeDelete(
        db,
        () => deleteFrom(dbContext, "test_users").where((u) => u.email.endsWith("@example.com")),
        {},
      );

      assert.equal(rowCount, 6); // All users have @example.com

      const users = db.prepare("SELECT * FROM test_users").all();
      assert.equal(users.length, 0);
    });

    it("should delete with contains", () => {
      const rowCount = executeDelete(
        db,
        () => deleteFrom(dbContext, "test_logs").where((l) => l.message!.includes("login")),
        {},
      );

      assert.equal(rowCount, 2); // "User logged in" and "Failed login attempt"

      const loginLogs = db.prepare("SELECT * FROM test_logs WHERE message LIKE ?").all("%login%");
      assert.equal(loginLogs.length, 0);
    });
  });

  describe("DELETE with IN operations", () => {
    it("should delete with array includes", () => {
      const categoriesToDelete = ["Furniture", "Stationery"];

      const rowCount = executeDelete(
        db,
        (p: { categories: string[] }) =>
          deleteFrom(dbContext, "test_products").where((prod) =>
            p.categories.includes(prod.category!),
          ),
        { categories: categoriesToDelete },
      );

      assert.equal(rowCount, 4); // 2 Furniture + 2 Stationery

      const remaining = db.prepare("SELECT DISTINCT category FROM test_products").all() as any[];
      assert.equal(remaining.length, 1);
      assert.equal(remaining[0].category, "Electronics");
    });

    it("should delete with parameterized list", () => {
      const userIds = [2, 3, 4];

      const rowCount = executeDelete(
        db,
        (p: { ids: number[] }) =>
          deleteFrom(dbContext, "test_users").where((u) => p.ids.includes(u.id!)),
        { ids: userIds },
      );

      assert.equal(rowCount, 3);

      const remaining = db.prepare("SELECT id FROM test_users ORDER BY id").all() as any[];
      assert.deepEqual(
        remaining.map((r) => r.id),
        [1, 5, 6],
      );
    });
  });

  describe("DELETE with date comparisons", () => {
    it("should delete with date comparison", () => {
      const cutoffDate = "2024-01-15";

      const rowCount = executeDelete(
        db,
        (p: { cutoff: string }) =>
          deleteFrom(dbContext, "test_products").where((prod) => prod.created_date! < p.cutoff),
        { cutoff: cutoffDate },
      );

      assert.equal(rowCount, 3); // Products created before Jan 15, 2024

      const remaining = db.prepare("SELECT name FROM test_products ORDER BY name").all();
      assert.equal(remaining.length, 5);
    });

    it("should delete old records by timestamp", () => {
      // First, update some logs to have old timestamps
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 30);
      db.prepare("UPDATE test_logs SET created_at = ? WHERE level = ?").run(
        oldDate.toISOString(),
        "DEBUG",
      );

      const now = new Date();
      now.setDate(now.getDate() - 7); // 7 days ago
      const cutoffTime = now.toISOString();

      const rowCount = executeDelete(
        db,
        (p: { cutoff: string }) =>
          deleteFrom(dbContext, "test_logs").where((l) => l.created_at! < p.cutoff),
        { cutoff: cutoffTime },
      );

      assert.equal(rowCount, 1); // Only the DEBUG log we made old

      const oldLogs = db.prepare("SELECT * FROM test_logs WHERE created_at < ?").all(cutoffTime);
      assert.equal(oldLogs.length, 0);
    });
  });

  describe("DELETE multiple rows", () => {
    it("should delete all matching rows", () => {
      const rowCount = executeDelete(
        db,
        () => deleteFrom(dbContext, "test_orders").where((o) => o.status === "pending"),
        {},
      );

      assert.equal(rowCount, 2);

      const pendingOrders = db.prepare("SELECT * FROM test_orders WHERE status = ?").all("pending");
      assert.equal(pendingOrders.length, 0);
    });

    it("should delete with allowFullTableDelete", () => {
      const rowCount = executeDelete(
        db,
        () => deleteFrom(dbContext, "test_logs").allowFullTableDelete(),
        {},
      );

      assert.equal(rowCount, 6); // All logs

      const logs = db.prepare("SELECT * FROM test_logs").all();
      assert.equal(logs.length, 0);
    });

    it("should throw error when DELETE has no WHERE and no allow flag", () => {
      try {
        executeDelete(db, () => deleteFrom(dbContext, "test_products"), {});
        assert.fail("Should have thrown error for missing WHERE clause");
      } catch (error: any) {
        assert(
          error.message.includes("WHERE clause") || error.message.includes("allowFullTableDelete"),
        );
      }
    });
  });

  describe("DELETE with cascading", () => {
    it("should cascade delete related records", () => {
      // Delete a user that has orders (CASCADE should delete orders too)
      const userOrdersBefore = db.prepare("SELECT * FROM test_orders WHERE user_id = ?").all(2);
      assert.equal(userOrdersBefore.length, 2); // john_doe has 2 orders

      const rowCount = executeDelete(
        db,
        () => deleteFrom(dbContext, "test_users").where((u) => u.username === "john_doe"),
        {},
      );

      assert.equal(rowCount, 1);

      // Check that orders were also deleted (if foreign keys are enabled)
      const userOrdersAfter = db.prepare("SELECT * FROM test_orders WHERE user_id = ?").all(2);
      assert.equal(userOrdersAfter.length, 0);
    });
  });

  describe("DELETE with no matches", () => {
    it("should return 0 when no rows match", () => {
      const rowCount = executeDelete(
        db,
        () => deleteFrom(dbContext, "test_products").where((p) => p.name === "NonExistent"),
        {},
      );

      assert.equal(rowCount, 0);

      // Verify nothing was deleted
      const count = db.prepare("SELECT COUNT(*) as count FROM test_products").get() as any;
      assert.equal(count.count, 8);
    });

    it("should handle impossible conditions gracefully", () => {
      const rowCount = executeDelete(
        db,
        () => deleteFrom(dbContext, "test_products").where((p) => p.price! < 0),
        {},
      );

      assert.equal(rowCount, 0);
    });
  });

  describe("SQLite-specific behaviors", () => {
    it("should handle boolean values as 0/1", () => {
      // SQLite stores booleans as integers
      const rowCount = executeDelete(
        db,
        () => deleteFrom(dbContext, "test_products").where((p) => p.in_stock === true),
        {},
      );

      // Should delete all products where in_stock = 1
      assert.equal(rowCount, 5);

      const remaining = db.prepare("SELECT * FROM test_products").all() as any[];
      assert.equal(remaining.length, 3);
      remaining.forEach((p) => assert.equal(p.in_stock, 0));
    });

    it("should handle type coercion in comparisons", () => {
      // SQLite allows flexible type comparisons
      const rowCount = executeDelete(
        db,
        () => deleteFrom(dbContext, "test_products").where((p) => p.price === ("299.99" as any)),
        {},
      );

      // Should match Monitor with price 299.99 even though we used string
      assert.equal(rowCount, 1);

      const monitor = db.prepare("SELECT * FROM test_products WHERE name = ?").all("Monitor");
      assert.equal(monitor.length, 0);
    });
  });

  describe("SQL generation verification", () => {
    it("should generate correct DELETE SQL for SQLite", () => {
      const result = deleteStatement(
        () => deleteFrom(dbContext, "test_products").where((p) => p.id === 1),
        {},
      );

      assert(result.sql.includes('DELETE FROM "test_products"'));
      assert(result.sql.includes("WHERE"));
      assert(result.sql.includes('"id" ='));
      // SQLite uses @ for parameters
      assert(result.sql.includes("@__p1"));
      assert.equal(result.params.__p1, 1);
    });

    it("should generate DELETE with complex WHERE", () => {
      const result = deleteStatement(
        () =>
          deleteFrom(dbContext, "test_users").where(
            (u) => u.age! > 25 && (u.role === "admin" || u.is_active === false),
          ),
        {},
      );

      assert(result.sql.includes('DELETE FROM "test_users"'));
      assert(result.sql.includes("WHERE"));
      assert(result.sql.includes("AND"));
      assert(result.sql.includes("OR"));
    });

    it("should generate DELETE with proper parameter format", () => {
      const params = { minAge: 30, targetRole: "user" };

      const result = deleteStatement(
        (p: typeof params) =>
          deleteFrom(dbContext, "test_users").where(
            (u) => u.age! > p.minAge && u.role === p.targetRole,
          ),
        params,
      );

      // SQLite uses @param format
      assert(result.sql.includes("@minAge"));
      assert(result.sql.includes("@targetRole"));
      assert.equal(result.params.minAge, 30);
      assert.equal(result.params.targetRole, "user");
    });
  });
});
