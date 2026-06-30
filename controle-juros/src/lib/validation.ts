import { z } from "zod";

export const moneySchema = z.coerce.number().finite().positive("O valor deve ser maior que zero.");
export const percentSchema = z.coerce.number().finite().min(0, "A taxa não pode ser negativa.").max(1000, "Taxa inválida.");
export const installmentCountSchema = z.coerce.number().int().min(1, "Quantidade de parcelas deve ser no mínimo 1.");

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido."),
  password: z.string().min(1, "Senha obrigatória.")
});

export const adminSetupSchema = z.object({
  email: z.string().email("E-mail inválido."),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres.")
});

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório."),
  document: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().email("E-mail inválido."),
  password: z.string().min(1, "Senha obrigatória."),
  active: z.boolean().default(true)
});

export const clientUpdateSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório.").optional(),
  document: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().email("E-mail inválido.").optional(),
  password: z.string().optional(),
  active: z.boolean().optional()
});

export const requestCreateSchema = z.object({
  amount: moneySchema,
  observation: z.string().trim().optional().nullable()
});

export const agreementSchema = z.object({
  clientId: z.string().min(1, "Cliente obrigatório."),
  requestId: z.string().optional().nullable(),
  originalValue: moneySchema,
  installmentsCount: installmentCountSchema,
  interestRate: percentSchema,
  dueDate: z.string().min(1, "Vencimento obrigatório."),
  status: z.enum(["ABERTO", "PAGO", "ATRASADO", "CANCELADO"]).default("ABERTO"),
  observations: z.string().trim().optional().nullable(),
  dailyInterestRate: z.coerce.number().finite().min(0).optional().nullable()
});

export const agreementUpdateSchema = agreementSchema.partial().omit({ clientId: true, requestId: true });
