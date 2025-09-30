/**
 * Test schema for SQL generator tests
 */

import { createContext } from "@webpods/tinqer";

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

  // Additional tables for comprehensive testing
  events: {
    id: number;
    title: string;
    startDate: Date;
    endDate: Date | null;
    createdAt: Date;
    updatedAt: Date | null;
    location: string | null;
    isRecurring: boolean;
  };

  categories: {
    id: number;
    name: string;
    parentId: number | null;
    level: number;
    path: string;
    isLeaf: boolean;
    sortOrder: number;
  };

  comments: {
    id: number;
    content: string;
    parentCommentId: number | null;
    userId: number;
    createdAt: Date;
    depth: number;
    likes: number;
  };

  accounts: {
    id: number;
    balance: number;
    creditLimit: number;
    interestRate: number;
    overdraftFee: number | null;
    minimumBalance: number;
    lastTransactionDate: Date | null;
  };

  articles: {
    id: number;
    title: string;
    content: string;
    author: string;
    tags: string;
    publishedAt: Date;
    views: number;
    featured: boolean;
  };

  measurements: {
    id: number;
    temperature: number;
    pressure: number;
    humidity: number | null;
    timestamp: Date;
    sensorId: string;
  };
}

// Create the database context
export const db = createContext<TestSchema>();

// Re-export from for use with db context
export { from } from "@webpods/tinqer";
