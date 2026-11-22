import { MongoClient, type Db, type Collection, ObjectId } from "mongodb";
import { attachDatabasePool } from "@vercel/functions";
import { env } from "../config/env.js";

export type Role = "vendor" | "customer" | "admin";
export type ItemStatus = "pending" | "approved" | "rejected" | "inactive";
export type OrderStatus = "pending" | "accepted" | "rejected" | "cancelled";

export interface UserDoc {
  _id: ObjectId;
  name: string;
  email: string;
  image?: string | null;
  role: Role;
  isBlocked?: boolean;
  businessName?: string;
  subscriptionPlan?: "free" | "premium";
  subscriptionExpiresAt?: Date | null;
  stripeCustomerId?: string;
  favorites?: ObjectId[];
}

export interface MenuItemDoc {
  _id: ObjectId;
  vendorId: ObjectId;
  itemName: string;
  category: string;
  description: string;
  price: number;
  location: string;
  images: string[];
  status: ItemStatus;
  deactivatedBy?: "vendor" | "admin" | "system" | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderDoc {
  _id: ObjectId;
  itemId: ObjectId;
  vendorId: ObjectId;
  customerId: ObjectId;
  deliveryDate: Date;
  deliveryAddress: string;
  message: string;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: Date }[];
  createdAt: Date;
}

export interface TransactionDoc {
  _id: ObjectId;
  vendorId: ObjectId;
  plan: string;
  amount: number;
  currency: string;
  stripeSessionId?: string;
  stripeSubscriptionId?: string;
  stripeInvoiceId?: string;
  status: "pending" | "paid" | "failed" | "canceled";
  createdAt: Date;
}

let clientPromise: Promise<MongoClient> | null = null;

function getClient(): Promise<MongoClient> {
  if (!clientPromise) {
    // Atlas shared tiers can take several seconds to finish the primary handshake.
    const client = new MongoClient(env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 20_000,
      connectTimeoutMS: 20_000,
    });
    attachDatabasePool(client);
    clientPromise = client
      .connect()
      .catch((err) => {
        clientPromise = null;
        throw err;
      });
  }
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  return (await getClient()).db(env.MONGODB_DB);
}

export const collections = {
  users: async (): Promise<Collection<UserDoc>> => (await getDb()).collection<UserDoc>("users"),
  menuItems: async (): Promise<Collection<MenuItemDoc>> =>
    (await getDb()).collection<MenuItemDoc>("menuItems"),
  orders: async (): Promise<Collection<OrderDoc>> => (await getDb()).collection<OrderDoc>("orders"),
  transactions: async (): Promise<Collection<TransactionDoc>> =>
    (await getDb()).collection<TransactionDoc>("transactions"),
};
