---
name: API hook naming
description: Exact generated hook names, correct option patterns, and type gotchas for @workspace/api-client-react
---

## Auth
- Login: POST /api/auth/login via `customFetch` directly (no generated hook)
- Register: POST /api/auth/register — REQUIRES email verification first (POST /api/auth/send-verification)
- Profile update: PATCH /api/auth/me via `customFetch` with `Authorization: Bearer <token>`

## Orders
- `useListOrders(params?: ListOrdersParams)` — returns `OrdersPage { orders, total, page, limit }`
  - Do NOT pass `{ query: { retry: 1 } }` — the `UseQueryOptions` type requires `queryKey` in v5
  - `params`: `{ page, limit, status?: OrderStatus }`
- `useGetOrder(id: number, options?)` — returns `OrderDetail` (Order + items + address + tracking)
- `useGetOrderTracking(id: number, options?)` — returns `TrackingEvent[]`
  - For `enabled` option: must include `queryKey` → use `getGetOrderQueryKey(id)` / `getGetOrderTrackingQueryKey(id)`

## Addresses
- `useListAddresses()` — returns `Address[]` directly (no pagination)
- `useCreateAddress({ data: CreateAddressBody })`
- `useUpdateAddress({ id, data: UpdateAddressBody })` — use for set-as-default
- `useDeleteAddress({ id })`

## Cart
- `useAddToCart({ data: AddToCartBody })` — `AddToCartBody: { productId: number, quantity: number, variantId?: number }`
  - CartItem.id is `string`; use `item.numericId ?? parseInt(item.id, 10)` for productId

## Wishlist
- `useGetWishlist()` — returns `WishlistItem[]`
- `useAddToWishlist({ data: { productId } })`
- `useRemoveFromWishlist({ productId })`

## Notifications
- `useListNotifications()` — returns `Notification[]` (no params, no pagination)
- `useMarkNotificationRead({ id })`
- `useMarkAllNotificationsRead()`

## Coupon
- `useValidateCoupon({ data: ValidateCouponBody })`
  - `ValidateCouponBody: { code: string, orderAmount: number }` (NOT `orderTotal`)
  - Returns `CouponValidationResult: { valid, discount, message }` (NOT `discountAmount`)

## Flash Sales
- `useGetActiveFlashSale()` — returns `FlashSaleDetail { ...FlashSale, products: Product[] }`
  - API `Product` type conflicts with local `@/lib/data` `Product` — cast with `as unknown as LocalProduct[]`

## Workspace package setup
- `@workspace/api-client-react` must be in `artifacts/web/package.json` dependencies as `"workspace:*"`
- Symlinks already exist in `artifacts/web/node_modules/@workspace/`

## CartContext
- `addItem({ id: number, name, price, image, quantity, variantId? })` — added for numeric-ID products from API
- `addToCart(product: LocalProduct, qty?)` — original method for local Product objects
- `CartItem.variantId?: number` — added field
- `CartItem.numericId?: number` — added field for round-tripping to API

**Why:** The local CartContext was designed for static mock data (string IDs). API integration needed numeric IDs and addItem helper without breaking existing ProductCard usage.
