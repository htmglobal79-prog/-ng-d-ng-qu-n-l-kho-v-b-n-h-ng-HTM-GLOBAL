import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { adjustStock, createProduct, createSale, getDashboardStats, listProducts } from "./db";

const productInput = z.object({
  sku: z.string().min(2).max(64), name: z.string().min(2).max(180), category: z.string().min(1).max(80),
  unit: z.string().min(1).max(24), price: z.number().int().nonnegative(), cost: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative(), minStock: z.number().int().nonnegative(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 }); return { success: true } as const; }),
  }),
  dashboard: router({ stats: publicProcedure.query(() => getDashboardStats()) }),
  products: router({
    list: publicProcedure.input(z.object({ search: z.string().optional() }).optional()).query(({ input }) => listProducts(input?.search)),
    create: protectedProcedure.input(productInput).mutation(({ input }) => createProduct(input)),
  }),
  inventory: router({
    adjust: protectedProcedure.input(z.object({ productId: z.number().int(), quantity: z.number().int(), type: z.enum(['purchase', 'adjustment']), note: z.string().optional() })).mutation(({ ctx, input }) => adjustStock(input.productId, input.quantity, input.type, input.note, ctx.user.id)),
  }),
  sales: router({
    create: protectedProcedure.input(z.object({ items: z.array(z.object({ productId: z.number().int(), productName: z.string(), quantity: z.number().int().positive(), unitPrice: z.number().int().nonnegative(), lineTotal: z.number().int().nonnegative() })).min(1), discount: z.number().int().nonnegative(), paymentMethod: z.enum(['cash', 'card', 'transfer']) })).mutation(async ({ ctx, input }) => {
      try { return await createSale({ ...input, createdBy: ctx.user.id }); }
      catch (error) { console.error(error); throw new TRPCError({ code: 'BAD_REQUEST', message: 'Không thể tạo đơn hàng. Vui lòng kiểm tra tồn kho và thử lại.' }); }
    }),
  }),
});

export type AppRouter = typeof appRouter;
