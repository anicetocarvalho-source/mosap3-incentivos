/**
 * Skeletons reutilizáveis para uniformizar os estados de carregamento
 * em todo o sistema.
 *
 *  - <TableRowsSkeleton rows cols />: linhas de skeleton para <tbody>.
 *  - <CardListSkeleton count />: cartões empilhados (versão mobile divide-y).
 *  - <StatCardsSkeleton count />: KPIs/cartões em grelha.
 *  - <ChartSkeleton />: placeholder para gráficos.
 */
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface TableRowsSkeletonProps {
  rows?: number;
  cols?: number;
  /** Larguras opcionais por coluna (Tailwind). */
  colWidths?: string[];
  className?: string;
}

export function TableRowsSkeleton({
  rows = 5,
  cols = 4,
  colWidths,
  className,
}: TableRowsSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className={cn("border-b border-border", className)}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <Skeleton className={cn("h-4", colWidths?.[j] ?? "w-24")} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

interface CardListSkeletonProps {
  count?: number;
  className?: string;
}

export function CardListSkeleton({ count = 5, className }: CardListSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn("p-4 space-y-2", className)}>
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </>
  );
}

interface StatCardsSkeletonProps {
  count?: number;
  className?: string;
}

export function StatCardsSkeleton({ count = 4, className }: StatCardsSkeletonProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-3"
        >
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-7 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-[280px] w-full rounded-lg", className)} />;
}
