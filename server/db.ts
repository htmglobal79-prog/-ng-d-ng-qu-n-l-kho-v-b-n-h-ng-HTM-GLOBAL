import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, inventoryMovements, products, saleItems, sales, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); }
    catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  (['name', 'email', 'loginMethod'] as const).forEach(field => {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  });
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
  values.lastSignedIn ??= new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listProducts(search?: string) {
  const db = await getDb();
  if (!db) return [];
  const where = search ? sql`(${products.name} like ${`%${search}%`} or ${products.sku} like ${`%${search}%`} or ${products.category} like ${`%${search}%`})` : undefined;
  return db.select().from(products).where(where).orderBy(products.name);
}

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { revenueToday: 0, ordersToday: 0, lowStockCount: 0, inventoryValue: 0, recentSales: [], topProducts: [] };
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const [today, low, value, recent, top] = await Promise.all([
    db.select({ revenue: sql<number>`coalesce(sum(${sales.total}), 0)`, orders: sql<number>`count(*)` }).from(sales).where(and(gte(sales.createdAt, start), lt(sales.createdAt, end))),
    db.select({ count: sql<number>`count(*)` }).from(products).where(and(eq(products.status, 'active'), sql`${products.stock} <= ${products.minStock}`)),
    db.select({ value: sql<number>`coalesce(sum(${products.stock} * ${products.cost}), 0)` }).from(products).where(eq(products.status, 'active')),
    db.select().from(sales).orderBy(desc(sales.createdAt)).limit(6),
    db.select({ productName: saleItems.productName, quantity: sql<number>`sum(${saleItems.quantity})`, revenue: sql<number>`sum(${saleItems.lineTotal})` }).from(saleItems).groupBy(saleItems.productName).orderBy(desc(sql`sum(${saleItems.quantity})`)).limit(5),
  ]);
  return { revenueToday: Number(today[0]?.revenue ?? 0), ordersToday: Number(today[0]?.orders ?? 0), lowStockCount: Number(low[0]?.count ?? 0), inventoryValue: Number(value[0]?.value ?? 0), recentSales: recent, topProducts: top };
}

export async function createProduct(input: { sku: string; name: string; category: string; unit: string; price: number; cost: number; stock: number; minStock: number }) {
  const db = await getDb();
  if (!db) throw new Error('Database unavailable');
  const result = await db.insert(products).values(input);
  const id = Number(result[0].insertId);
  return (await db.select().from(products).where(eq(products.id, id)).limit(1))[0];
}

export async function adjustStock(productId: number, quantity: number, type: 'purchase' | 'adjustment', note?: string, createdBy?: number) {
  const db = await getDb();
  if (!db) throw new Error('Database unavailable');
  await db.update(products).set({ stock: sql`${products.stock} + ${quantity}` }).where(eq(products.id, productId));
  await db.insert(inventoryMovements).values({ productId, quantity, type, note, createdBy });
  return (await db.select().from(products).where(eq(products.id, productId)).limit(1))[0];
}

export async function createSale(input: { items: Array<{ productId: number; productName: string; quantity: number; unitPrice: number; lineTotal: number }>; discount: number; paymentMethod: 'cash' | 'card' | 'transfer'; createdBy?: number }) {
  const db = await getDb();
  if (!db) throw new Error('Database unavailable');
  const subtotal = input.items.reduce((sum, item) => sum + item.lineTotal, 0);
  const total = Math.max(0, subtotal - input.discount);
  const invoiceNo = `HD${Date.now().toString().slice(-8)}`;
  const saleResult = await db.insert(sales).values({ invoiceNo, subtotal, discount: input.discount, total, paymentMethod: input.paymentMethod, createdBy: input.createdBy });
  const saleId = Number(saleResult[0].insertId);
  await db.insert(saleItems).values(input.items.map(item => ({ saleId, ...item })));
  for (const item of input.items) {
    await db.update(products).set({ stock: sql`${products.stock} - ${item.quantity}` }).where(eq(products.id, item.productId));
    await db.insert(inventoryMovements).values({ productId: item.productId, type: 'sale', quantity: -item.quantity, note: invoiceNo, createdBy: input.createdBy });
  }
  return { id: saleId, invoiceNo, subtotal, discount: input.discount, total, paymentMethod: input.paymentMethod };
}
