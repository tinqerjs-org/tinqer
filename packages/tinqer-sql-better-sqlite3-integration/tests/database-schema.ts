/**
 * Database schema types and context for Better SQLite3 integration tests
 */

import { createContext } from "@webpods/tinqer";

/**
 * Database schema types matching the SQLite tables
 */
export interface TestDatabaseSchema {
  users: {
    id: number;
    name: string;
    email: string;
    age: number | null;
    salary: number;
    department_id: number | null;
    manager_id: number | null;
    is_active: number; // SQLite uses INTEGER (0 or 1) for boolean values
    created_at: Date;
  };

  departments: {
    id: number;
    name: string;
    budget: number | null;
  };

  products: {
    id: number;
    name: string;
    price: number;
    stock: number;
    category: string | null;
    description: string | null;
    created_at: Date;
  };

  orders: {
    id: number;
    user_id: number;
    order_date: Date;
    total_amount: number;
    status: string;
    created_at: Date;
  };

  order_items: {
    id: number;
    order_id: number;
    product_id: number;
    quantity: number;
    unit_price: number;
  };

  // Additional tables for comprehensive testing
  events: {
    id: number;
    title: string;
    start_date: Date;
    end_date: Date | null;
    location: string | null;
    is_recurring: number; // SQLite uses INTEGER (0 or 1) for boolean values
    created_at: Date;
    updated_at: Date | null;
  };

  categories: {
    id: number;
    name: string;
    parent_id: number | null;
    level: number;
    path: string;
    is_leaf: number; // SQLite uses INTEGER (0 or 1) for boolean values
    sort_order: number;
  };

  comments: {
    id: number;
    content: string;
    parent_comment_id: number | null;
    user_id: number;
    created_at: Date;
    depth: number;
  };

  accounts: {
    id: number;
    user_id: number;
    balance: number;
    credit_limit: number;
    interest_rate: number;
    last_transaction_date: Date | null;
  };

  articles: {
    id: number;
    title: string;
    content: string;
    author: string;
    tags: string;
    published_at: Date;
    views: number;
    is_featured: number; // SQLite uses INTEGER (0 or 1) for boolean values
  };
}

// Type aliases for convenience
export type User = TestDatabaseSchema["users"];
export type Department = TestDatabaseSchema["departments"];
export type Product = TestDatabaseSchema["products"];
export type Order = TestDatabaseSchema["orders"];
export type OrderItem = TestDatabaseSchema["order_items"];
export type Event = TestDatabaseSchema["events"];
export type Category = TestDatabaseSchema["categories"];
export type Comment = TestDatabaseSchema["comments"];
export type Account = TestDatabaseSchema["accounts"];
export type Article = TestDatabaseSchema["articles"];

/**
 * Typed database context for use with from() function
 */
export const dbContext = createContext<TestDatabaseSchema>();
