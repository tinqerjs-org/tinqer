# Known Limitations

## Chained JOINs with Result Selectors

**Status:** Architectural limitation - requires subquery/CTE support

**Issue:** Result selectors in intermediate JOINs are not supported. When a JOIN has a result selector that transforms or renames columns, those transformed columns cannot be referenced by subsequent JOINs. This is because the result selector creates a projection, but the SQL generator doesn't wrap it in a subquery, so the projected columns don't exist for the next JOIN to reference.

### Technical Explanation

When you write a chained JOIN with result selectors, the parsed query understands the column mappings, but the SQL generator produces invalid SQL because it tries to reference columns that only exist in the projection, not in the base tables.

### Example of Problematic Pattern

```typescript
from(dbContext, "order_items")
  .join(
    from(dbContext, "orders"),
    (oi) => oi.order_id,
    (o) => o.id,
    (oi, o) => ({
      // Result selector renames/transforms columns
      productId: oi.product_id,  // Renamed from product_id to productId
      orderId: o.id,
      // ... other fields
    })
  )
  .join(
    from(dbContext, "products"),
    (joined) => joined.productId,  // ❌ Tries to access renamed column
    (p) => p.id,
    (joined, p) => ({ /* ... */ })
  )
```

### The Problem

The SQL generator creates:
```sql
-- Incorrect: tries to access t0.productId (doesn't exist)
INNER JOIN "products" AS "t2" ON "t0"."productId" = "t2"."id"
```

Instead of:
```sql
-- Would need to reference the projection or use subquery/CTE
```

### Root Cause

The architecture currently treats chained JOINs as operations on the original tables with their aliases (t0, t1, etc.), not on the projected results from previous JOINs. When a JOIN has a result selector, it creates a projection, but subsequent operations don't work with that projection.

### Workarounds

1. **Don't use result selectors in intermediate JOINs** - Only use result selectors in the final JOIN or SELECT:
   ```typescript
   from(dbContext, "order_items")
     .join(
       from(dbContext, "orders"),
       (oi) => oi.order_id,
       (o) => o.id
       // No result selector here
     )
     .join(
       from(dbContext, "products"),
       (oi) => oi.product_id,  // Reference original column
       (p) => p.id
     )
     .select((joined) => ({
       // Do all transformations in final SELECT
       productId: joined.product_id,
       orderId: joined.id,
       // ...
     }))
   ```

2. **Use separate queries** - Break complex multi-JOIN queries into smaller queries

### Proper Fix

Would require refactoring the SQL generator to:
- Generate subqueries or CTEs for JOINs with result selectors
- Track column aliases through the query chain
- Build a proper query plan that understands projections

This is a significant architectural change that would affect the entire JOIN SQL generation system.

### Affected Tests

The following integration tests are currently skipped due to this limitation:
- `should join order_items with orders and products`
- `should join users with departments and count orders`
- `should find top products by revenue`
- `should analyze department spending`