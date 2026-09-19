import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(user: TrpcContext["user"] = null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

const manager = {
  id: 7,
  openId: "retailflow-manager",
  email: "manager@example.com",
  name: "Store Manager",
  loginMethod: "manus",
  role: "admin" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

describe("RetailFlow access control", () => {
  it("allows the dashboard summary to be read without a session", async () => {
    const result = await appRouter.createCaller(context()).dashboard.stats();
    expect(result).toHaveProperty("revenueToday");
    expect(result).toHaveProperty("lowStockCount");
    expect(result).toHaveProperty("recentSales");
  });

  it("blocks creating products for signed-out users", async () => {
    await expect(appRouter.createCaller(context()).products.create({
      sku: "TEST-001",
      name: "Sản phẩm thử",
      category: "Khác",
      unit: "cái",
      price: 10000,
      cost: 5000,
      stock: 0,
      minStock: 2,
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("validates that a sale contains at least one line item", async () => {
    await expect(appRouter.createCaller(context(manager)).sales.create({
      items: [],
      discount: 0,
      paymentMethod: "cash",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
