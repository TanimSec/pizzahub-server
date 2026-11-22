# PizzaHub Server

REST API for **PizzaHub**, a pizza ordering and delivery platform where customers order from local shops, vendors manage menus and orders, and admins moderate the platform.

- **Live API:** https://pizzahub-server-orpin.vercel.app
- **Live site:** https://pizzahub-client-alpha-hazel.vercel.app
- **Client repository:** https://github.com/TanimSec/pizzahub-client
- **Server repository:** https://github.com/TanimSec/pizzahub-server

## Features

- Better Auth JWT verification (JWKS) with role middleware for Admin, Vendor and Customer
- Public menu browsing: search, category and location filters, price range, price sorting, pagination
- Vendor menu CRUD with ownership checks, image upload (Cloudinary by default, ImgBB optional), free-plan limit of 3 active items
- Order flow: duplicate and self-order protection, atomic accept/reject/cancel, status timeline
- Admin: user search, role filter, block/unblock (sessions revoked), item review, read-only transactions, stats
- Stripe subscription Checkout; Premium is activated only by a signature-verified webhook
- Renewals, failed invoices, cancellation and expiry handled via webhooks, with automatic free-plan downgrade

## Tech stack

express, mongodb, jose, zod, stripe, multer, cors, helmet, express-rate-limit, morgan, dotenv, typescript, tsx

## Installation

```bash
git clone https://github.com/TanimSec/pizzahub-server.git
cd pizzahub-server
npm install
cp .env.example .env   # then fill in the values
```

## Run locally

```bash
npm run dev          # http://localhost:5000
npm run typecheck
```

Forward Stripe webhooks locally:

```bash
stripe listen --forward-to localhost:5000/api/webhooks/stripe
```

## Environment variables

| Name | Purpose |
|---|---|
| PORT | Local port |
| NODE_ENV | development / production |
| MONGODB_URI, MONGODB_DB | MongoDB connection |
| CLIENT_URL | Allowed CORS origin and Stripe return URLs |
| AUTH_JWKS_URL | Better Auth JWKS endpoint (client app: /api/auth/jwks) |
| JWT_ISSUER, JWT_AUDIENCE | Expected token issuer and audience |
| STRIPE_SECRET_KEY | Stripe secret key |
| STRIPE_WEBHOOK_SECRET | Stripe webhook signing secret |
| STRIPE_PREMIUM_PRICE_ID | Recurring monthly Premium price |
| IMAGE_PROVIDER | `cloudinary` (default) or `imgbb` |
| CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET | Cloudinary credentials (when provider is cloudinary) |
| IMGBB_API_KEY | ImgBB key (when provider is imgbb) |

Secrets live only in `.env` / hosting settings and are never committed.

## Challenge implementation notes

### Advanced search and sorting

`GET /api/menu` (public) accepts:

| Query | Meaning |
|---|---|
| q | Case-insensitive match on name, description, location and category (regex-escaped) |
| category | One of the six categories |
| location | Case-insensitive location match |
| minPrice, maxPrice | Inclusive price range |
| sort | `price_asc`, `price_desc` or `newest` (default); ties broken by `_id` for stable pages |
| page, limit | Pagination (limit max 48, default 12) |

Only `approved` items from non-blocked vendors are returned, via one aggregation: `$match` then `$lookup` vendor then `$facet` (items + total). Response: `{ items, total, page, pages, limit }`.

### JWT verification middleware flow

1. `verifyJWT` reads `Authorization: Bearer <token>`, verifies signature (remote JWKS), issuer, audience and expiry with `jose`. Missing, invalid or expired tokens return **401**.
2. `loadUser` loads the user from MongoDB by the token subject. Role, block status and plan always come from the database, never from the token or request body. Unknown user returns **401**; blocked user returns **403**; expired Premium is downgraded lazily.
3. `requireRole(...)` returns **403** if the role does not match.
4. zod validation returns **400**. Controllers add ownership to every query filter (`{ _id, vendorId }`), so another vendor's resource returns **404**.

### Payment security

- The checkout session is created for the vendor in the token only; no vendor id is accepted from the client.
- `/api/webhooks/stripe` uses the raw body and `constructEvent` to verify the signature. The success redirect never activates Premium; `GET /api/payments/session/:id` only reports the webhook-recorded status.
- Handled events: `checkout.session.completed`, `invoice.paid` (renewals), `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `checkout.session.expired`.
- Transactions are read-only for admins: no write route exists.

## API overview

| Area | Routes |
|---|---|
| Public | `GET /api/menu`, `/api/menu/featured`, `/api/menu/categories`, `/api/menu/locations` |
| Authenticated | `GET /api/menu/:id`, `POST /api/uploads/image`, `GET/PATCH /api/users/me` |
| Vendor | `/api/vendor/stats`, `/items`, `/items/:id`, `/items/:id/availability`, `/orders`, `/orders/:id` |
| Customer | `/api/customer/stats`, `/api/orders`, `/orders/my`, `/orders/:id`, `/orders/:id/cancel`, `/api/users/me/favorites` |
| Admin | `/api/admin/stats`, `/users`, `/users/:id/block`, `/items`, `/items/:id/status`, `/transactions` |
| Payments | `/api/payments/checkout-session`, `/session/:id`, `/my-transactions`, `/cancel-subscription` |

## Testing payments

Use Stripe test mode with card `4242 4242 4242 4242`, any future expiry and any CVC.
