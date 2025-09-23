/**
 * Tests for set operations: UNION, CONCAT (UNION ALL), INTERSECT, EXCEPT
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { from } from "@webpods/tinqer";
import { toSql } from "@webpods/tinqer-sql-pg-promise";

describe("Set Operations", () => {
  describe("UNION", () => {
    it("should generate UNION for union() method", () => {
      const query = from("customers")
        .select((c) => ({ name: c.name, city: c.city }))
        .union(from("suppliers").select((s) => ({ name: s.company_name, city: s.city })));

      const sql = toSql(query);
      expect(sql.text).to.equal(
        "(SELECT c.name AS name, c.city AS city FROM customers c) " +
          "UNION " +
          "(SELECT s.company_name AS name, s.city AS city FROM suppliers s)",
      );
    });

    it("should handle UNION with WHERE clauses", () => {
      const query = from("employees")
        .where((e) => e.department === "Sales")
        .select((e) => ({ id: e.id, name: e.name }))
        .union(
          from("contractors")
            .where((c) => c.active === true)
            .select((c) => ({ id: c.contractor_id, name: c.full_name })),
        );

      const sql = toSql(query);
      expect(sql.text).to.equal(
        "(SELECT e.id AS id, e.name AS name FROM employees e WHERE e.department = $(param_0)) " +
          "UNION " +
          "(SELECT c.contractor_id AS id, c.full_name AS name FROM contractors c WHERE c.active = $(param_1))",
      );
      expect(sql.parameters).to.deep.equal({ param_0: "Sales", param_1: true });
    });

    it("should handle UNION with simple SELECT *", () => {
      const query = from("active_users").union(from("inactive_users"));

      const sql = toSql(query);
      expect(sql.text).to.equal(
        "(SELECT * FROM active_users a) UNION (SELECT * FROM inactive_users i)",
      );
    });
  });

  describe("CONCAT (UNION ALL)", () => {
    it("should generate UNION ALL for concat() method", () => {
      const query = from("orders_2023")
        .select((o) => ({ order_id: o.id, total: o.amount }))
        .concat(from("orders_2024").select((o) => ({ order_id: o.id, total: o.amount })));

      const sql = toSql(query);
      expect(sql.text).to.equal(
        "(SELECT o.id AS order_id, o.amount AS total FROM orders_2023 o) " +
          "UNION ALL " +
          "(SELECT o.id AS order_id, o.amount AS total FROM orders_2024 o)",
      );
    });

    it("should preserve duplicates with concat()", () => {
      const query = from("sales_q1")
        .where((s) => s.region === "North")
        .concat(from("sales_q2").where((s) => s.region === "North"));

      const sql = toSql(query);
      expect(sql.text).to.equal(
        "(SELECT * FROM sales_q1 s WHERE s.region = $(param_0)) " +
          "UNION ALL " +
          "(SELECT * FROM sales_q2 s WHERE s.region = $(param_1))",
      );
      expect(sql.parameters).to.deep.equal({ param_0: "North", param_1: "North" });
    });

    it("should handle concat() with different filters", () => {
      const query = from("products")
        .where((p) => p.category === "Electronics")
        .select((p) => ({ name: p.name, price: p.price }))
        .concat(
          from("products")
            .where((p) => p.category === "Books")
            .select((p) => ({ name: p.title, price: p.cost })),
        );

      const sql = toSql(query);
      expect(sql.text).to.equal(
        "(SELECT p.name AS name, p.price AS price FROM products p WHERE p.category = $(param_0)) " +
          "UNION ALL " +
          "(SELECT p.title AS name, p.cost AS price FROM products p WHERE p.category = $(param_1))",
      );
      expect(sql.parameters).to.deep.equal({ param_0: "Electronics", param_1: "Books" });
    });
  });

  describe("INTERSECT", () => {
    it("should generate INTERSECT for intersect() method", () => {
      const query = from("premium_customers")
        .select((c) => ({ customer_id: c.id, name: c.name }))
        .intersect(
          from("vip_members").select((v) => ({ customer_id: v.member_id, name: v.full_name })),
        );

      const sql = toSql(query);
      expect(sql.text).to.equal(
        "(SELECT p.id AS customer_id, p.name AS name FROM premium_customers p) " +
          "INTERSECT " +
          "(SELECT v.member_id AS customer_id, v.full_name AS name FROM vip_members v)",
      );
    });

    it("should handle INTERSECT with WHERE clauses", () => {
      const query = from("users")
        .where((u) => u.age >= 18)
        .select((u) => ({ id: u.user_id }))
        .intersect(
          from("verified_accounts")
            .where((v) => v.verified === true)
            .select((v) => ({ id: v.account_id })),
        );

      const sql = toSql(query);
      expect(sql.text).to.equal(
        "(SELECT u.user_id AS id FROM users u WHERE u.age >= $(param_0)) " +
          "INTERSECT " +
          "(SELECT v.account_id AS id FROM verified_accounts v WHERE v.verified = $(param_1))",
      );
      expect(sql.parameters).to.deep.equal({ param_0: 18, param_1: true });
    });

    it("should find common records with intersect()", () => {
      const query = from("employees_ny")
        .select((e) => ({ emp_id: e.id, dept: e.department }))
        .intersect(from("employees_ca").select((e) => ({ emp_id: e.id, dept: e.department })));

      const sql = toSql(query);
      expect(sql.text).to.equal(
        "(SELECT e.id AS emp_id, e.department AS dept FROM employees_ny e) " +
          "INTERSECT " +
          "(SELECT e.id AS emp_id, e.department AS dept FROM employees_ca e)",
      );
    });
  });

  describe("EXCEPT", () => {
    it("should generate EXCEPT for except() method", () => {
      const query = from("all_products")
        .select((p) => ({ product_id: p.id, name: p.name }))
        .except(
          from("discontinued_products").select((d) => ({
            product_id: d.prod_id,
            name: d.prod_name,
          })),
        );

      const sql = toSql(query);
      expect(sql.text).to.equal(
        "(SELECT a.id AS product_id, a.name AS name FROM all_products a) " +
          "EXCEPT " +
          "(SELECT d.prod_id AS product_id, d.prod_name AS name FROM discontinued_products d)",
      );
    });

    it("should handle EXCEPT with WHERE clauses", () => {
      const query = from("customers")
        .where((c) => c.country === "USA")
        .select((c) => ({ id: c.customer_id }))
        .except(
          from("blacklisted_customers")
            .where((b) => b.active === true)
            .select((b) => ({ id: b.cust_id })),
        );

      const sql = toSql(query);
      expect(sql.text).to.equal(
        "(SELECT c.customer_id AS id FROM customers c WHERE c.country = $(param_0)) " +
          "EXCEPT " +
          "(SELECT b.cust_id AS id FROM blacklisted_customers b WHERE b.active = $(param_1))",
      );
      expect(sql.parameters).to.deep.equal({ param_0: "USA", param_1: true });
    });

    it("should find records in first set but not in second with except()", () => {
      const query = from("registered_users")
        .select((r) => ({ user_id: r.id, email: r.email }))
        .except(
          from("unsubscribed_users").select((u) => ({
            user_id: u.user_id,
            email: u.email_address,
          })),
        );

      const sql = toSql(query);
      expect(sql.text).to.equal(
        "(SELECT r.id AS user_id, r.email AS email FROM registered_users r) " +
          "EXCEPT " +
          "(SELECT u.user_id AS user_id, u.email_address AS email FROM unsubscribed_users u)",
      );
    });
  });

  describe("Complex Set Operations", () => {
    it("should handle set operations with DISTINCT", () => {
      const query = from("sales_2023")
        .distinct()
        .select((s) => ({ product: s.product_name }))
        .union(
          from("sales_2024")
            .distinct()
            .select((s) => ({ product: s.product_name })),
        );

      const sql = toSql(query);
      expect(sql.text).to.equal(
        "(SELECT DISTINCT s.product_name AS product FROM sales_2023 s) " +
          "UNION " +
          "(SELECT DISTINCT s.product_name AS product FROM sales_2024 s)",
      );
    });

    it("should handle set operations with ORDER BY and LIMIT", () => {
      const query = from("top_sellers")
        .orderBy((t) => t.revenue)
        .take(10)
        .select((t) => ({ id: t.seller_id, revenue: t.revenue }))
        .union(
          from("new_sellers")
            .orderBy((n) => n.potential)
            .take(5)
            .select((n) => ({ id: n.seller_id, revenue: n.estimated_revenue })),
        );

      const sql = toSql(query);
      expect(sql.text).to.equal(
        "(SELECT t.seller_id AS id, t.revenue AS revenue FROM top_sellers t ORDER BY t.revenue LIMIT 10) " +
          "UNION " +
          "(SELECT n.seller_id AS id, n.estimated_revenue AS revenue FROM new_sellers n ORDER BY n.potential LIMIT 5)",
      );
    });

    it("should handle set operations with aggregates", () => {
      const query = from("sales_online")
        .groupBy((s) => s.category)
        .select((g) => ({ category: g.key, total: g.items.sum((i) => i.amount) }))
        .union(
          from("sales_retail")
            .groupBy((s) => s.category)
            .select((g) => ({ category: g.key, total: g.items.sum((i) => i.amount) })),
        );

      const sql = toSql(query);
      expect(sql.text).to.equal(
        "(SELECT s.category AS category, SUM(s.amount) AS total FROM sales_online s GROUP BY s.category) " +
          "UNION " +
          "(SELECT s.category AS category, SUM(s.amount) AS total FROM sales_retail s GROUP BY s.category)",
      );
    });
  });
});
