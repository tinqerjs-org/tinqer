/**
 * Shared test schema for all test files
 */

import { createSchema } from "../dist/index.js";

// Common test schema
export interface TestSchema {
  users: {
    id: number;
    name: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    age: number;
    status: string;
    role: string;
    isActive: boolean;
    isAdmin: boolean;
    isDeleted: boolean;
    salary: number;
    department: string;
    city: string;
    country: string;
    createdAt: Date;
  };
  orders: {
    id: number;
    userId: number;
    user_id: number; // Both naming conventions
    productId: number;
    product_id: number; // Both naming conventions
    orderId: number;
    amount: number;
    total: number;
    quantity: number;
    status: string;
    date: Date;
    createdAt: Date;
  };
  products: {
    id: number;
    productId: number;
    name: string;
    price: number;
    cost: number;
    category: string;
    categoryId: number;
    inStock: boolean;
    quantity: number;
  };
  employees: {
    id: number;
    employeeId: number;
    name: string;
    firstName: string;
    lastName: string;
    department: string;
    salary: number;
    position: string;
    age: number;
  };
  departments: {
    id: number;
    departmentId: number;
    name: string;
    budget: number;
  };
  categories: {
    id: number;
    categoryId: number;
    name: string;
    parentId: number;
  };
  customers: {
    id: number;
    customerId: number;
    name: string;
    email: string;
    phone: string;
  };
  items: {
    id: number;
    name: string;
    value: number;
  };
}

// Shared database context for all tests
export const schema = createSchema<TestSchema>();
