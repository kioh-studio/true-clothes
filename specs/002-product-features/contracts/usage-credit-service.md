# Contract: Usage Credit Service

**File**: `src/services/usageCreditService.ts`

## Functions

### `checkCredit(type: 'worn_outfit_scan'): Promise<CreditStatus>`

```typescript
interface CreditStatus {
  used: number
  limit: number
  remaining: number
  isPremium: boolean
}
```

Queries `usage_credits` for current calendar month. If no row exists, returns
`{ used: 0, limit: 2, remaining: 2 }` (free tier default).
If `isPremium` (RevenueCat entitlement), `limit = Infinity`.

**Throws**: `InsufficientCreditsError` only when `remaining === 0 AND !isPremium`.

### `incrementCredit(type: 'worn_outfit_scan'): Promise<void>`

UPSERT with atomic `used = used + 1`. Creates row for current month if absent.

---

## Error Types

```typescript
class InsufficientCreditsError extends Error {
  used: number
  limit: number
}
```
