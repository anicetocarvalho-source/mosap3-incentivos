import { z } from "zod";

export const farmerSchema = z.object({
  nome: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
  bi: z.string().max(20, "BI muito longo").regex(/^$|^[0-9A-Za-z]+$/, "BI com caracteres inválidos").optional().or(z.literal("")),
  dataNascimento: z.string().optional().or(z.literal("")),
  genero: z.string().optional().or(z.literal("")),
  telefone: z.string().max(20).regex(/^$|^\+?[0-9\s]{9,20}$/, "Telefone inválido").optional().or(z.literal("")),
  provincia: z.string().optional().or(z.literal("")),
  municipio: z.string().max(100).optional().or(z.literal("")),
  escolaCampo: z.string().optional().or(z.literal("")),
  patec: z.string().min(1, "PATEC é obrigatório").regex(/^[1-3]$/, "PATEC deve ser 1, 2 ou 3"),
});

export const dependentSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
  relationship: z.string().min(1, "Parentesco é obrigatório"),
  gender: z.string().optional().or(z.literal("")),
  birth_date: z.string().optional().or(z.literal("")),
  education: z.string().optional().or(z.literal("")),
  occupation: z.string().trim().max(100, "Ocupação muito longa").optional().or(z.literal("")),
});

export const parcelSchema = z.object({
  culture: z.string().min(1, "Cultura é obrigatória"),
  area: z.string().regex(/^[0-9]+(\.[0-9]+)?$/, "Área deve ser um número válido"),
  lat: z.string().regex(/^$|^-?[0-9]+(\.[0-9]+)?$/, "Latitude inválida").optional().or(z.literal("")),
  lon: z.string().regex(/^$|^-?[0-9]+(\.[0-9]+)?$/, "Longitude inválida").optional().or(z.literal("")),
});

export const transactionSchema = z.object({
  product: z.string().trim().min(1, "Produto é obrigatório").max(200, "Produto muito longo"),
  empresa: z.string().trim().min(1, "Empresa é obrigatória").max(200, "Empresa muito longa"),
  valor: z.string().min(1, "Valor é obrigatório").regex(/^[0-9.,]+$/, "Valor deve ser numérico"),
  transaction_date: z.string().optional().or(z.literal("")),
});
