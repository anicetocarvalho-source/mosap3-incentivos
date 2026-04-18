import * as React from "react";
import { format, startOfMonth, startOfQuarter, startOfYear, endOfMonth, endOfQuarter, endOfYear } from "date-fns";
import { pt } from "date-fns/locale";
import { Calendar as CalendarIcon, X } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface PeriodValue {
  from?: Date;
  to?: Date;
}

interface PeriodFilterProps {
  value: PeriodValue;
  onChange: (v: PeriodValue) => void;
}

const PeriodFilter: React.FC<PeriodFilterProps> = ({ value, onChange }) => {
  const range: DateRange | undefined =
    value.from || value.to ? { from: value.from, to: value.to } : undefined;

  const label = (() => {
    if (value.from && value.to) {
      return `${format(value.from, "dd/MM/yyyy")} – ${format(value.to, "dd/MM/yyyy")}`;
    }
    if (value.from) return `Desde ${format(value.from, "dd/MM/yyyy")}`;
    return "Todo o período";
  })();

  const setQuick = (kind: "month" | "quarter" | "year") => {
    const now = new Date();
    if (kind === "month") onChange({ from: startOfMonth(now), to: endOfMonth(now) });
    if (kind === "quarter") onChange({ from: startOfQuarter(now), to: endOfQuarter(now) });
    if (kind === "year") onChange({ from: startOfYear(now), to: endOfYear(now) });
  };

  const clear = () => onChange({});
  const hasValue = !!(value.from || value.to);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 gap-2 border-white/20 bg-white/5 text-xs backdrop-blur-sm",
            "hover:bg-white/10",
          )}
          style={{ color: "hsl(var(--sidebar-foreground))" }}
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          <span>{label}</span>
          {hasValue && (
            <X
              className="ml-1 h-3.5 w-3.5 opacity-70 hover:opacity-100"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                clear();
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex flex-wrap gap-2 border-b border-border p-3">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setQuick("month")}>
            Mês actual
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setQuick("quarter")}>
            Trimestre actual
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setQuick("year")}>
            Ano actual
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={clear}>
            Limpar
          </Button>
        </div>
        <Calendar
          mode="range"
          locale={pt}
          numberOfMonths={2}
          selected={range}
          onSelect={(r) => onChange({ from: r?.from, to: r?.to })}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
};

export default PeriodFilter;
