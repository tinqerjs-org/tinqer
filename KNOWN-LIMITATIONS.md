# Known Limitations

## Chained JOINs with Result Selectors

**Status:** Partially supported - simple property access works, but pass-through properties have limitations

**Issue:** Result selectors in intermediate JOINs have limited support. Basic renaming of columns works, but passing through properties from earlier JOINs in the chain may fail. This is because the symbol table doesn't fully track all property mappings through multiple levels of JOINs.

### Technical Explanation

When you write a chained JOIN with result selectors, the parsed query understands the column mappings, but the SQL generator produces invalid SQL because it tries to reference columns that only exist in the projection, not in the base tables.

### Working Pattern

```typescript
// This now works - simple renamed properties in chained JOINs
from(dbContext, "order_items")
  .join(
    from(dbContext, "orders"),
    (oi) => oi.order_id,
    (o) => o.id,
    (oi, o) => ({
      productId: oi.product_id,  // Renamed column
      orderId: o.id,
    })
  )
  .join(
    from(dbContext, "products"),
    (joined) => joined.productId,  // ✅ Works - resolves to t0.product_id
    (p) => p.id,
    (joined, p) => ({
      orderId: joined.orderId,     // Direct reference
      productName: p.name,
    })
  )
```

### Still Problematic Pattern

```typescript
// Passing through multiple properties from earlier JOINs may fail
from(dbContext, "users")
  .join(
    from(dbContext, "departments"),
    (u) => u.department_id,
    (d) => d.id,
    (u, d) => ({
      userId: u.id,
      userName: u.name,
      departmentName: d.name,  // From departments table
    })
  )
  .join(
    from(dbContext, "orders"),
    (joined) => joined.userId,
    (o) => o.user_id,
    (joined, o) => ({
      userName: joined.userName,
      departmentName: joined.departmentName,  // ❌ May not resolve correctly
      orderTotal: o.total_amount,
    })
  )
```

### The Problem

When properties from the first JOIN's result are passed through the second JOIN's result selector, the symbol table may not correctly track their source tables, leading to incorrect SQL generation.

### Root Cause

The result shape from JOINs is built correctly, and simple property renaming works. However, when passing properties through multiple levels of JOINs, the symbol table building doesn't fully preserve all mappings, especially for properties that come from tables other than the immediate outer table in the JOIN chain.

### Workarounds

1. **Don't use result selectors in intermediate JOINs** - Only use result selectors in the final JOIN or SELECT:

   ```typescript
   from(dbContext, "order_items")
     .join(
       from(dbContext, "orders"),
       (oi) => oi.order_id,
       (o) => o.id,
       // No result selector here
     )
     .join(
       from(dbContext, "products"),
       (oi) => oi.product_id, // Reference original column
       (p) => p.id,
     )
     .select((joined) => ({
       // Do all transformations in final SELECT
       productId: joined.product_id,
       orderId: joined.id,
       // ...
     }));
   ```

2. **Use separate queries** - Break complex multi-JOIN queries into smaller queries

### Proper Fix

Would require refactoring the SQL generator to:

- Generate subqueries or CTEs for JOINs with result selectors
- Track column aliases through the query chain
- Build a proper query plan that understands projections

This is a significant architectural change that would affect the entire JOIN SQL generation system.

### Affected Tests

The following integration tests show the current support status:

- ✅ `should join order_items with orders and products` - Works with simple property renaming
- ❌ `should join users with departments and count orders` - Fails when passing through department properties
- ❌ `should find top products by revenue` - Fails due to complex property pass-through
- ❌ `should analyze department spending` - Fails due to complex property pass-through
