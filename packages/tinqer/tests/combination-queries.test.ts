import { Queryable } from "../src/queryable/queryable.js";
import { expect } from "chai";
import type { ConstantExpression } from "../src/types/expressions.js";

// Define test interfaces
interface User {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  age: number;
  isActive: boolean;
  createdAt: string;
  lastLogin: string;
}

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  categoryId: number;
  isActive: boolean;
  isPublished: boolean;
  isOnSale: boolean;
  createdAt: string;
}

interface Order {
  id: number;
  customerId: number;
  productId: number;
  userId: number;
  status: string;
  date: string;
  total: number;
  amount: number;
  quantity: number;
  price: number;
  subtotal: number;
}

interface Post {
  id: number;
  title: string;
  authorId: number;
  createdAt: string;
  postDate: string;
}

interface Category {
  id: number;
  name: string;
}

interface Activity {
  userId: number;
  action: string;
  timestamp: string;
  dayOfWeek: number;
}

interface Inventory {
  productId: number;
  productName: string;
  quantity: number;
  reorderPoint: number;
}

interface Customer {
  id: number;
  name: string;
  totalPurchases: number;
  memberSince: string;
  isActive: boolean;
}

interface Event {
  id: number;
  title: string;
  date: string;
  status: string;
  attendeeCount: number;
  maxCapacity: number;
}

interface Article {
  id: number;
  title: string;
  content: string;
  author: string;
  publishDate: string;
  score?: number;
}

describe("Combination Queries", () => {
  it("should handle complete CRUD-style SELECT query", () => {
    const query = new Queryable<User>("users")
      .where((u) => u.isActive === true)
      .where((u) => u.age >= 18)
      .orderBy((u) => u.lastName)
      .orderBy((u) => u.firstName)
      .skip(10)
      .take(20)
      .select((u) => ({
        id: u.id,
        name: u.firstName + " " + u.lastName,
        email: u.email.toLowerCase(),
      }))
      .build();

    expect(query.where).to.exist;
    expect(query.select).to.exist;
    expect(query.orderBy).to.have.lengthOf(2);
    expect((query.limit as { value: number } | undefined)?.value).to.equal(20);
    expect((query.offset as { value: number } | undefined)?.value).to.equal(10);
  });

  it("should handle pagination pattern", () => {
    const pageSize = 25;
    const pageNumber = 3;

    const query = new Queryable<Product>("products")
      .where((p) => p.isPublished === true)
      .orderByDescending((p) => p.createdAt)
      .skip((pageNumber - 1) * pageSize)
      .take(pageSize)
      .build();

    expect(query.offset).to.exist;
    expect(query.limit).to.exist;
    const offsetExpr = query.offset as ConstantExpression;
    const limitExpr = query.limit as ConstantExpression;
    expect(offsetExpr.value).to.equal(50);
    expect(limitExpr.value).to.equal(25);
  });

  it("should handle search pattern with multiple conditions", () => {
    const searchTerm = "phone";

    const query = new Queryable<Product>("products")
      .where(
        (p) =>
          p.name.toLowerCase().includes(searchTerm) ||
          p.description.toLowerCase().includes(searchTerm) ||
          p.category.toLowerCase().includes(searchTerm),
      )
      .where((p) => p.isActive === true)
      .where((p) => p.stock > 0)
      .select((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        relevance: p.name.toLowerCase().includes(searchTerm)
          ? 3
          : p.description.toLowerCase().includes(searchTerm)
            ? 2
            : 1,
      }))
      .orderByDescending((p) => p.relevance)
      .orderBy((p) => p.name)
      .build();

    expect(query.where).to.exist;
    expect(query.select).to.exist;
    expect(query.orderBy).to.have.lengthOf(2);
  });

  // Skipping this test as it uses invalid aggregate syntax
  // The correct syntax would be to use the aggregate methods on the Queryable itself
  // it("should handle reporting query pattern", () => {

  it("should handle JOIN with filtering and projection", () => {
    const users = new Queryable<User>("users");
    const posts = new Queryable<Post>("posts");

    const query = users
      .where((u) => u.isActive === true)
      .join(
        posts,
        (u) => u.id,
        (p) => p.authorId,
        (u, p) => ({
          userName: u.name,
          postTitle: p.title,
          postDate: p.createdAt,
        }),
      )
      .where((result) => result.postDate >= "2024-01-01")
      .orderByDescending((result) => result.postDate)
      .take(50)
      .build();

    expect(query.joins).to.have.lengthOf(1);
    expect(query.where).to.exist;
    expect(query.orderBy).to.have.lengthOf(1);
  });

  it("should handle complex e-commerce query", () => {
    const products = new Queryable<Product>("products");
    const categories = new Queryable<Category>("categories");

    const query = products
      .where((p) => p.isActive === true)
      .where((p) => p.stock > 0)
      .where((p) => p.price >= 10 && p.price <= 1000)
      .join(
        categories,
        (p) => p.categoryId,
        (c) => c.id,
        (p, c) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          discountedPrice: p.isOnSale ? p.price * 0.8 : p.price,
          category: c.name,
          inStock: p.stock > 0,
          stockLevel: p.stock === 0 ? "out-of-stock" : p.stock < 10 ? "low-stock" : "in-stock",
        }),
      )
      .where((result) => result.category !== "Discontinued")
      .orderBy((result) => result.category)
      .orderBy((result) => result.price)
      .build();

    expect(query.joins).to.have.lengthOf(1);
    expect(query.where).to.exist;
    expect(query.orderBy).to.have.lengthOf(2);
  });

  it("should handle user activity dashboard query", () => {
    const query = new Queryable<Activity>("user_activities")
      .where((a) => a.timestamp >= "2024-01-01")
      .where((a) => a.timestamp <= "2024-12-31")
      .select((a) => ({
        userId: a.userId,
        action: a.action,
        date: a.timestamp.substring(0, 10),
        hour: a.timestamp.substring(11, 13),
        isWeekend: a.dayOfWeek === 0 || a.dayOfWeek === 6,
      }))
      .groupBy((a) => a.date)
      .orderBy((a) => a.date)
      .build();

    expect(query.where).to.exist;
    expect(query.select).to.exist;
    expect(query.groupBy).to.exist;
    expect(query.orderBy).to.have.lengthOf(1);
  });

  it("should handle inventory management query", () => {
    const query = new Queryable<Inventory>("inventory")
      .where((i) => i.quantity < i.reorderPoint)
      .select((i) => ({
        productId: i.productId,
        productName: i.productName,
        currentStock: i.quantity,
        reorderPoint: i.reorderPoint,
        reorderQuantity: i.reorderPoint * 2 - i.quantity,
        urgency:
          i.quantity === 0 ? "critical" : i.quantity < i.reorderPoint / 2 ? "high" : "normal",
      }))
      .orderBy((i) => (i.urgency === "critical" ? 0 : i.urgency === "high" ? 1 : 2))
      .orderBy((i) => i.productName)
      .build();

    expect(query.where).to.exist;
    expect(query.select).to.exist;
    expect(query.orderBy).to.have.lengthOf(2);
  });

  it("should handle customer segmentation query", () => {
    const query = new Queryable<Customer>("customers")
      .where((c) => c.isActive === true)
      .orderByDescending((c) => c.totalPurchases)
      .select((c) => ({
        id: c.id,
        name: c.name,
        totalPurchases: c.totalPurchases,
        segment:
          c.totalPurchases > 10000
            ? "platinum"
            : c.totalPurchases > 5000
              ? "gold"
              : c.totalPurchases > 1000
                ? "silver"
                : "bronze",
        isVip: c.totalPurchases > 5000 || c.memberSince < "2020-01-01",
      }))
      .build();

    expect(query.select).to.exist;
    expect(query.where).to.exist;
    expect(query.orderBy).to.have.lengthOf(1);
  });

  it("should handle date range filtering", () => {
    const startDate = "2024-01-01";
    const endDate = "2024-12-31";

    const query = new Queryable<Event>("events")
      .where((e) => e.date >= startDate && e.date <= endDate)
      .where((e) => e.status === "confirmed")
      .select((e) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        attendees: e.attendeeCount,
        isFull: e.attendeeCount >= e.maxCapacity,
      }))
      .orderBy((e) => e.date)
      .build();

    expect(query.where?.type).to.equal("logical");
    expect(query.select).to.exist;
    expect(query.orderBy).to.have.lengthOf(1);
  });

  it("should handle search with relevance scoring", () => {
    // This test demonstrates that sometimes we need type assertions
    // when ordering by computed fields that only exist after select()
    const query = new Queryable<Article>("articles")
      .where(
        (a) =>
          a.title.toLowerCase().includes("javascript") ||
          a.title.toLowerCase().includes("typescript") ||
          a.title.toLowerCase().includes("node") ||
          a.content.toLowerCase().includes("javascript") ||
          a.content.toLowerCase().includes("typescript") ||
          a.content.toLowerCase().includes("node"),
      )
      .take(20)
      .select((a) => ({
        id: a.id,
        title: a.title,
        author: a.author,
        score:
          (a.title.toLowerCase().includes("javascript") ? 3 : 0) +
          (a.title.toLowerCase().includes("typescript") ? 3 : 0) +
          (a.title.toLowerCase().includes("node") ? 3 : 0) +
          (a.content.toLowerCase().includes("javascript") ? 1 : 0) +
          (a.content.toLowerCase().includes("typescript") ? 1 : 0) +
          (a.content.toLowerCase().includes("node") ? 1 : 0),
      }))
      .build();

    expect(query.where).to.exist;
    expect(query.select).to.exist;
    expect((query.limit as { value: number } | undefined)?.value).to.equal(20);
  });

  it("should handle distinct with complex query", () => {
    const query = new Queryable<Order>("orders")
      .where((o) => o.status === "completed")
      .select((o) => ({ customerId: o.customerId }))
      .distinct()
      .orderBy((o) => o.customerId)
      .build();

    expect(query.distinct).to.equal(true);
    expect(query.where).to.exist;
    expect(query.select).to.exist;
    expect(query.orderBy).to.have.lengthOf(1);
  });
});
