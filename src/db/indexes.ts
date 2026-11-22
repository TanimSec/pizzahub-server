import { collections } from "./mongo.js";

let ensured = false;

export async function ensureIndexes(): Promise<void> {
  if (ensured) return;
  const [users, items, orders, tx] = await Promise.all([
    collections.users(),
    collections.menuItems(),
    collections.orders(),
    collections.transactions(),
  ]);
  await Promise.all([
    users.createIndex({ role: 1 }),
    items.createIndex({ status: 1, category: 1 }),
    items.createIndex({ vendorId: 1, status: 1 }),
    items.createIndex({ price: 1 }),
    orders.createIndex({ customerId: 1, itemId: 1, deliveryDate: 1, status: 1 }),
    orders.createIndex({ vendorId: 1, status: 1 }),
    orders.createIndex(
      { customerId: 1, itemId: 1, deliveryDate: 1 },
      { unique: true, partialFilterExpression: { status: { $in: ["pending", "accepted"] } } },
    ),
    tx.createIndex({ stripeSessionId: 1 }, { unique: true, sparse: true }),
    tx.createIndex({ stripeInvoiceId: 1 }, { unique: true, sparse: true }),
    tx.createIndex({ vendorId: 1, createdAt: -1 }),
  ]);
  ensured = true;
}
