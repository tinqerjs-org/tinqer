/**
 * Database schema types and context for PostgreSQL integration tests
 */

import { createContext } from "@webpods/tinqer";

/**
 * Database schema types matching the PostgreSQL tables
 */
export interface TestDatabaseSchema {
  users: {
    id: number;
    name: string;
    email: string;
    age: number | null;
    department_id: number | null;
    is_active: boolean;
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
}

// Type aliases for convenience
export type User = TestDatabaseSchema["users"];
export type Department = TestDatabaseSchema["departments"];
export type Product = TestDatabaseSchema["products"];
export type Order = TestDatabaseSchema["orders"];
export type OrderItem = TestDatabaseSchema["order_items"];

/**
 * Typed database context for use with from() function
 */
export const dbContext = createContext<TestDatabaseSchema>();
