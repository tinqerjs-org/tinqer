/**
 * Shared test setup and teardown for PostgreSQL integration tests
 */

import type { IDatabase } from "pg-promise";

export async function setupTestDatabase(db: IDatabase<any>) {
  // Drop existing tables
  await db.none(`
    DROP TABLE IF EXISTS order_items CASCADE;
    DROP TABLE IF EXISTS orders CASCADE;
    DROP TABLE IF EXISTS products CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS departments CASCADE;
  `);

  // Create departments table
  await db.none(`
    CREATE TABLE departments (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      budget DECIMAL(10, 2)
    );
  `);

  // Create users table
  await db.none(`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      age INTEGER,
      department_id INTEGER,
      manager_id INTEGER,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (manager_id) REFERENCES users(id)
    );
  `);

  // Create products table
  await db.none(`
    CREATE TABLE products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      price DECIMAL(10, 2) NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      category VARCHAR(50),
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create orders table
  await db.none(`
    CREATE TABLE orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      order_date DATE NOT NULL DEFAULT CURRENT_DATE,
      total_amount DECIMAL(10, 2) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Create order_items table
  await db.none(`
    CREATE TABLE order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price DECIMAL(10, 2) NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  // Insert sample data
  // Insert departments
  await db.none(`
    INSERT INTO departments (name, budget) VALUES
    ('Engineering', 500000),
    ('Sales', 300000),
    ('Marketing', 200000),
    ('HR', 150000);
  `);

  // Insert users with manager relationships
  // First insert managers (no manager_id)
  await db.none(`
    INSERT INTO users (name, email, age, department_id, manager_id, is_active) VALUES
    ('John Doe', 'john@example.com', 30, 1, NULL, true),
    ('Jane Smith', 'jane@example.com', 25, 2, NULL, true),
    ('Charlie Wilson', 'charlie@example.com', 45, 4, NULL, false),
    ('Henry Ford', 'henry@example.com', 55, 4, NULL, true);
  `);

  // Then insert employees with managers
  await db.none(`
    INSERT INTO users (name, email, age, department_id, manager_id, is_active) VALUES
    ('Bob Johnson', 'bob@example.com', 35, 1, 1, true),        -- Reports to John Doe
    ('Alice Brown', 'alice@example.com', 28, 3, 2, true),      -- Reports to Jane Smith
    ('Diana Prince', 'diana@example.com', 33, 1, 1, true),     -- Reports to John Doe
    ('Eva Green', 'eva@example.com', 27, 2, 2, true),          -- Reports to Jane Smith
    ('Frank Castle', 'frank@example.com', 40, 1, 1, false),    -- Reports to John Doe
    ('Grace Hopper', 'grace@example.com', 38, 1, 1, true);     -- Reports to John Doe
  `);

  // Insert products
  await db.none(`
    INSERT INTO products (name, price, stock, category, description) VALUES
    ('Laptop', 999.99, 50, 'Electronics', 'High-performance laptop'),
    ('Mouse', 29.99, 200, 'Electronics', 'Wireless mouse'),
    ('Keyboard', 79.99, 150, 'Electronics', 'Mechanical keyboard'),
    ('Monitor', 299.99, 75, 'Electronics', '27-inch 4K monitor'),
    ('Desk', 499.99, 30, 'Furniture', 'Standing desk'),
    ('Chair', 399.99, 40, 'Furniture', 'Ergonomic office chair'),
    ('Notebook', 4.99, 500, 'Stationery', 'A5 notebook'),
    ('Pen', 1.99, 1000, 'Stationery', 'Blue ink pen'),
    ('Headphones', 199.99, 100, 'Electronics', 'Noise-canceling headphones'),
    ('Webcam', 89.99, 120, 'Electronics', 'HD webcam');
  `);

  // Insert orders
  await db.none(`
    INSERT INTO orders (user_id, order_date, total_amount, status) VALUES
    (1, '2024-01-15', 1029.98, 'completed'),
    (2, '2024-01-16', 109.98, 'completed'),
    (3, '2024-01-17', 299.99, 'shipped'),
    (1, '2024-01-18', 499.99, 'pending'),
    (4, '2024-01-19', 6.98, 'completed'),
    (5, '2024-01-20', 1299.97, 'cancelled'),
    (6, '2024-01-21', 89.99, 'completed'),
    (7, '2024-01-22', 599.98, 'shipped'),
    (8, '2024-01-23', 79.99, 'pending'),
    (9, '2024-01-24', 289.98, 'completed');
  `);

  // Insert order items
  await db.none(`
    INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (1, 1, 1, 999.99),
    (1, 2, 1, 29.99),
    (2, 2, 1, 29.99),
    (2, 3, 1, 79.99),
    (3, 4, 1, 299.99),
    (4, 5, 1, 499.99),
    (5, 7, 1, 4.99),
    (5, 8, 1, 1.99),
    (6, 1, 1, 999.99),
    (6, 4, 1, 299.99),
    (7, 10, 1, 89.99),
    (8, 9, 2, 199.99),
    (8, 2, 1, 29.99),
    (9, 3, 1, 79.99),
    (10, 9, 1, 199.99),
    (10, 10, 1, 89.99);
  `);
}
