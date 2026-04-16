/**
 * Centralised error handling utilities for the MOSAP3 platform.
 *
 * Provides:
 * - Translation of common Supabase / network error messages to Portuguese (PT-AO)
 * - Automatic retry with exponential back-off for transient failures
 * - Structured error classification (auth, network, validation, server)
 */

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

export type ErrorCategory = "auth" | "network" | "validation" | "server" | "unknown";

export interface ClassifiedError {
  category: ErrorCategory;
  title: string;
  description: string;
  /** Whether the operation can be safely retried */
  retryable: boolean;
}

// ---------------------------------------------------------------------------
// Translation maps
// ---------------------------------------------------------------------------

const AUTH_ERROR_MAP: Record<string, string> = {
  "Invalid login credentials": "Email ou password incorrectos. Verifique as credenciais e tente novamente.",
  "Email not confirmed": "O seu email ainda não foi confirmado. Verifique a caixa de entrada (e spam).",
  "User already registered": "Este email já está registado. Tente iniciar sessão.",
  "Signup requires a valid password": "A password deve ter pelo menos 6 caracteres.",
  "Password should be at least 6 characters": "A password deve ter pelo menos 6 caracteres.",
  "For security purposes, you can only request this once every 60 seconds":
    "Por segurança, aguarde 60 segundos antes de tentar novamente.",
  "User not found": "Utilizador não encontrado. Verifique o email introduzido.",
  "Email rate limit exceeded": "Muitas tentativas de envio de email. Aguarde alguns minutos.",
  "over_email_send_rate_limit": "Demasiados emails enviados. Tente novamente em alguns minutos.",
  "invalid_credentials": "Credenciais inválidas. Verifique o email e a password.",
  "email_not_confirmed": "Confirme o seu email antes de iniciar sessão.",
};

const NETWORK_PATTERNS: Array<[RegExp | string, string]> = [
  [/fetch|network|ERR_NETWORK|Failed to fetch/i, "Sem ligação à internet. Verifique a sua conexão e tente novamente."],
  [/timeout|ETIMEDOUT|ECONNABORTED/i, "O servidor demorou demasiado a responder. Tente novamente."],
  [/ECONNREFUSED/i, "Não foi possível ligar ao servidor. Tente novamente mais tarde."],
  [/rate limit|429/i, "Demasiadas tentativas. Aguarde alguns segundos e tente novamente."],
  [/503|service unavailable/i, "Serviço temporariamente indisponível. Tente novamente em breve."],
  [/502|bad gateway/i, "Erro de comunicação com o servidor. Tente novamente."],
];

const DB_ERROR_MAP: Record<string, string> = {
  "23505": "Registo duplicado — já existe um registo com os mesmos dados.",
  "23503": "Referência inválida — o registo referenciado não existe.",
  "42501": "Sem permissão para realizar esta operação. Contacte o administrador.",
  "PGRST301": "Sessão expirada. Faça login novamente.",
  "23514": "Dados inválidos — verifique os campos preenchidos.",
};

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export function classifyError(error: unknown): ClassifiedError {
  if (!error) {
    return { category: "unknown", title: "Erro desconhecido", description: "Ocorreu um erro inesperado.", retryable: false };
  }

  const message = typeof error === "string" ? error : (error as any)?.message || (error as any)?.msg || String(error);
  const code = (error as any)?.code || (error as any)?.status || "";

  // Auth errors
  for (const [key, translated] of Object.entries(AUTH_ERROR_MAP)) {
    if (message.includes(key)) {
      return { category: "auth", title: "Erro de autenticação", description: translated, retryable: false };
    }
  }

  // Network errors
  for (const [pattern, translated] of NETWORK_PATTERNS) {
    const matches = typeof pattern === "string" ? message.includes(pattern) : pattern.test(message);
    if (matches) {
      return { category: "network", title: "Erro de rede", description: translated, retryable: true };
    }
  }

  // Database constraint errors
  const codeStr = String(code);
  if (DB_ERROR_MAP[codeStr]) {
    return {
      category: codeStr === "PGRST301" || codeStr === "42501" ? "auth" : "validation",
      title: "Erro de dados",
      description: DB_ERROR_MAP[codeStr],
      retryable: false,
    };
  }

  // HTTP status-based classification
  const status = Number((error as any)?.status || (error as any)?.statusCode || 0);
  if (status === 401 || status === 403) {
    return { category: "auth", title: "Sessão expirada", description: "A sua sessão expirou. Faça login novamente.", retryable: false };
  }
  if (status >= 500) {
    return { category: "server", title: "Erro do servidor", description: "O servidor encontrou um problema. Tente novamente.", retryable: true };
  }

  // Fallback
  return {
    category: "unknown",
    title: "Erro",
    description: message || "Não foi possível completar a operação.",
    retryable: false,
  };
}

// ---------------------------------------------------------------------------
// Retry with exponential back-off
// ---------------------------------------------------------------------------

export interface RetryOptions {
  /** Maximum number of attempts (including the first) */
  maxAttempts?: number;
  /** Base delay in ms (doubled on each retry) */
  baseDelay?: number;
  /** Only retry if the error is classified as retryable */
  onlyRetryable?: boolean;
  /** Callback invoked before each retry */
  onRetry?: (attempt: number, error: ClassifiedError) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxAttempts = 3, baseDelay = 1000, onlyRetryable = true, onRetry } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const classified = classifyError(err);

      if (attempt === maxAttempts) throw err;
      if (onlyRetryable && !classified.retryable) throw err;

      onRetry?.(attempt, classified);
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// Supabase result helper
// ---------------------------------------------------------------------------

/** Throw if a Supabase response contains an error */
export function throwOnSupabaseError<T>(result: { data: T; error: any }): T {
  if (result.error) {
    const err = new Error(result.error.message || "Supabase error");
    (err as any).code = result.error.code;
    (err as any).status = result.error.status;
    throw err;
  }
  return result.data;
}
