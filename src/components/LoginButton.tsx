import { forwardRef } from "react";
import { Loader2, LogIn, type LucideIcon } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface LoginButtonProps extends Omit<ButtonProps, "children"> {
  /** Texto exibido no estado normal. */
  label: string;
  /** Texto exibido durante o loading. Default: "A entrar..." */
  loadingLabel?: string;
  /** Estado de carregamento. */
  loading?: boolean;
  /** Ícone à esquerda no estado normal. Default: LogIn. */
  icon?: LucideIcon;
  /** Aplica o gradiente primário do tema como background. */
  gradient?: boolean;
}

/**
 * Botão padronizado para acções de autenticação.
 * Garante sempre um label visível (normal ou loading) — nunca renderiza vazio.
 */
export const LoginButton = forwardRef<HTMLButtonElement, LoginButtonProps>(
  (
    {
      label,
      loadingLabel = "A entrar...",
      loading = false,
      icon: Icon = LogIn,
      gradient = true,
      className,
      disabled,
      style,
      type = "submit",
      ...props
    },
    ref,
  ) => {
    const safeLabel = label?.trim() || "Entrar";
    const safeLoadingLabel = loadingLabel?.trim() || "A entrar...";

    return (
      <Button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          "w-full h-11 font-semibold shadow-md",
          gradient && "text-primary-foreground",
          className,
        )}
        style={gradient ? { background: "var(--gradient-primary)", ...style } : style}
        aria-busy={loading || undefined}
        aria-label={loading ? safeLoadingLabel : safeLabel}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>{safeLoadingLabel}</span>
          </>
        ) : (
          <>
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span>{safeLabel}</span>
          </>
        )}
      </Button>
    );
  },
);

LoginButton.displayName = "LoginButton";
