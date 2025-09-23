-- Initialize databases for Tinqer testing
CREATE DATABASE tinqer_test;
CREATE DATABASE tinqer_integration;

-- Grant all privileges to postgres user
GRANT ALL PRIVILEGES ON DATABASE tinqer_test TO postgres;
GRANT ALL PRIVILEGES ON DATABASE tinqer_integration TO postgres;