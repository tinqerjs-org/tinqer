/**
 * Test schema for SQL generator tests
 */

import { createContext, type DatabaseContext } from "@webpods/tinqer";

// Define the test database schema
export interface TestSchema {
  users: {
    id: number;
    name: string;
    age: number;
    email: string | null;
    isActive: boolean;
    role: string;
    department: string;
    salary: number;
    city: string;
    country: string;
    phone: string;
    isDeleted: boolean;
    createdAt: Date;
    username: string;
    active: boolean;
    deptId: number;
  };

  products: {
    id: number;
    name: string;
    price: number;
    category: string;
    description: string;
    rating: number;
    discount: number;
    inStock: boolean;
  };

  orders: {
    id: number;
    userId: number;
    productId: number;
    quantity: number;
    total: number;
    status: string;
  };

  employees: {
    id: number;
    name: string;
    department: string;
    salary: number;
    managerId: number;
  };

  user_accounts: {
    id: number;
    username: string;
  };

  customers: {
    id: number;
    name: string;
  };

  customer_orders: {
    customerId: number;
    orderId: number;
  };

  posts: {
    id: number;
    createdAt: Date;
  };

  tasks: {
    id: number;
    status: string;
    priority: number;
  };

  sales: {
    category: string;
    amount: number;
    status: string;
  };

  departments: {
    id: number;
    name: string;
  };
}

// Create the database context
export const db = createContext<TestSchema>();

// Re-export from for use with db context
export { from } from "@webpods/tinqer";
