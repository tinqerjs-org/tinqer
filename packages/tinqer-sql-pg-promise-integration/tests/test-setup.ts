/**
 * Shared test setup and teardown for PostgreSQL integration tests
 */

import type { IDatabase } from "pg-promise";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function setupTestDatabase(db: IDatabase<any>) {
  // Drop existing tables
  await db.none(`
    DROP TABLE IF EXISTS order_items CASCADE;
    DROP TABLE IF EXISTS orders CASCADE;
    DROP TABLE IF EXISTS products CASCADE;
    DROP TABLE IF EXISTS comments CASCADE;
    DROP TABLE IF EXISTS categories CASCADE;
    DROP TABLE IF EXISTS events CASCADE;
    DROP TABLE IF EXISTS articles CASCADE;
    DROP TABLE IF EXISTS accounts CASCADE;
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
      salary DECIMAL(10, 2),
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
    INSERT INTO users (name, email, age, salary, department_id, manager_id, is_active) VALUES
    ('John Doe', 'john@example.com', 30, 120000, 1, NULL, true),
    ('Jane Smith', 'jane@example.com', 25, 95000, 2, NULL, true),
    ('Charlie Wilson', 'charlie@example.com', 45, 85000, 4, NULL, false),
    ('Henry Ford', 'henry@example.com', 55, 92000, 4, NULL, true);
  `);

  // Then insert employees with managers
  await db.none(`
    INSERT INTO users (name, email, age, salary, department_id, manager_id, is_active) VALUES
    ('Bob Johnson', 'bob@example.com', 35, 95000, 1, 1, true),        -- Reports to John Doe
    ('Alice Brown', 'alice@example.com', 28, 72000, 3, 2, true),      -- Reports to Jane Smith
    ('Diana Prince', 'diana@example.com', 33, 110000, 1, 1, true),     -- Reports to John Doe
    ('Eva Green', 'eva@example.com', 27, 78000, 2, 2, true),          -- Reports to Jane Smith
    ('Frank Castle', 'frank@example.com', 40, 88000, 1, 1, false),    -- Reports to John Doe
    ('Grace Hopper', 'grace@example.com', 38, 105000, 1, 1, true);     -- Reports to John Doe
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

  // Create events table for date/time testing
  await db.none(`
    CREATE TABLE events (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      start_date TIMESTAMP NOT NULL,
      end_date TIMESTAMP,
      location VARCHAR(200),
      is_recurring BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP
    );
  `);

  // Insert sample events
  await db.none(`
    INSERT INTO events (title, start_date, end_date, location, is_recurring, updated_at) VALUES
    ('Team Meeting', '2024-01-15 09:00:00', '2024-01-15 10:00:00', 'Conference Room A', true, '2024-01-14 15:00:00'),
    ('Product Launch', '2024-02-01 14:00:00', '2024-02-01 16:00:00', 'Main Hall', false, NULL),
    ('Training Session', '2024-01-20 10:00:00', '2024-01-20 17:00:00', 'Training Room', false, '2024-01-19 12:00:00'),
    ('Client Call', '2024-01-18 15:30:00', '2024-01-18 16:30:00', NULL, false, NULL),
    ('Sprint Review', '2024-01-26 14:00:00', '2024-01-26 15:00:00', 'Zoom', true, '2024-01-25 09:00:00');
  `);

  // Create categories table for hierarchical testing
  await db.none(`
    CREATE TABLE categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      parent_id INTEGER,
      level INTEGER NOT NULL,
      path VARCHAR(500) NOT NULL,
      is_leaf BOOLEAN DEFAULT false,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (parent_id) REFERENCES categories(id)
    );
  `);

  // Insert hierarchical categories
  await db.none(`
    INSERT INTO categories (name, parent_id, level, path, is_leaf, sort_order) VALUES
    ('Electronics', NULL, 0, '/electronics', false, 1),
    ('Computers', 1, 1, '/electronics/computers', false, 1),
    ('Laptops', 2, 2, '/electronics/computers/laptops', true, 1),
    ('Desktops', 2, 2, '/electronics/computers/desktops', true, 2),
    ('Phones', 1, 1, '/electronics/phones', false, 2),
    ('Smartphones', 5, 2, '/electronics/phones/smartphones', true, 1),
    ('Furniture', NULL, 0, '/furniture', false, 2),
    ('Office', 7, 1, '/furniture/office', false, 1),
    ('Chairs', 8, 2, '/furniture/office/chairs', true, 1),
    ('Desks', 8, 2, '/furniture/office/desks', true, 2);
  `);

  // Create comments table for nested structures
  await db.none(`
    CREATE TABLE comments (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      parent_comment_id INTEGER,
      user_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      depth INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (parent_comment_id) REFERENCES comments(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Insert nested comments
  await db.none(`
    INSERT INTO comments (content, parent_comment_id, user_id, depth) VALUES
    ('Great product!', NULL, 1, 0),
    ('I agree!', 1, 2, 1),
    ('Thanks for the feedback', 1, 3, 1),
    ('You are welcome', 3, 1, 2),
    ('Another top-level comment', NULL, 4, 0),
    ('Reply to second comment', 5, 5, 1);
  `);

  // Create accounts table for numeric testing
  await db.none(`
    CREATE TABLE accounts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      balance DECIMAL(15, 2) NOT NULL,
      credit_limit DECIMAL(15, 2) NOT NULL,
      interest_rate DECIMAL(5, 4) NOT NULL,
      last_transaction_date DATE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Insert accounts with various numeric values
  await db.none(`
    INSERT INTO accounts (user_id, balance, credit_limit, interest_rate, last_transaction_date) VALUES
    (1, 10000.50, 50000.00, 0.0325, '2024-01-20'),
    (2, -500.25, 10000.00, 0.1899, '2024-01-19'),
    (3, 0.00, 5000.00, 0.0000, NULL),
    (4, 999999999.99, 9999999.99, 0.0001, '2024-01-18'),
    (5, -9999.99, 15000.00, 0.2499, '2024-01-17');
  `);

  // Create articles table for search testing
  await db.none(`
    CREATE TABLE articles (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      content TEXT NOT NULL,
      author VARCHAR(100) NOT NULL,
      tags VARCHAR(500),
      published_at TIMESTAMP NOT NULL,
      views INTEGER DEFAULT 0,
      is_featured BOOLEAN DEFAULT false
    );
  `);

  // Insert articles for search patterns
  await db.none(`
    INSERT INTO articles (title, content, author, tags, published_at, views, is_featured) VALUES
    ('Introduction to SQL', 'SQL is a powerful language for database queries...', 'John Doe', 'sql,database,tutorial', '2024-01-10 10:00:00', 1500, true),
    ('Advanced JavaScript Patterns', 'JavaScript patterns help write better code...', 'Jane Smith', 'javascript,programming,patterns', '2024-01-12 14:00:00', 2500, false),
    ('Database Optimization Tips', 'Optimizing database performance is crucial...', 'Bob Johnson', 'database,performance,optimization', '2024-01-14 09:00:00', 1200, true),
    ('Web Security Best Practices', 'Security should be a top priority...', 'Alice Brown', 'security,web,best-practices', '2024-01-16 11:00:00', 3000, false),
    ('React Hooks Explained', 'React hooks revolutionized functional components...', 'Charlie Wilson', 'react,javascript,hooks', '2024-01-18 15:00:00', 1800, false);
  `);
}
