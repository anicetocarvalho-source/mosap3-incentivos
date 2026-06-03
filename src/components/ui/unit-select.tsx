import { useState, useEffect } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UNIT_OPTIONS, isCanonicalUnit, type UnitOption } from "@/lib/units";
import { Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface UnitSelectProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  allowCustom?: boolean;
}

const CUSTOM_VALUE = "__custom__";

const groupOrder: UnitOption["group"][] = [
  "Peso",
  "Volume",
  "Embalagem",
  "Animal/Vegetal",
  "Área/Medida",
];

export function UnitSelect({
  value,
  onChange,
  placeholder = "Unidade",
  className,
  triggerClassName,
  allowCustom = true,
}: UnitSelectProps) {
  const [customMode, setCustomMode] = useState<boolean>(() => !!value && !isCanonicalUnit(value));

  useEffect(() => {
    if (value && !isCanonicalUnit(value)) setCustomMode(true);
  }, [value]);

  if (customMode) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Unidade personalizada"
          className={cn("h-8 text-sm", triggerClassName)}
          maxLength={20}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => {
            setCustomMode(false);
            onChange("");
          }}
          title="Voltar à lista"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Select
      value={value || ""}
      onValueChange={(v) => {
        if (v === CUSTOM_VALUE) {
          setCustomMode(true);
          onChange("");
          return;
        }
        onChange(v);
      }}
    >
      <SelectTrigger className={cn("h-8 text-sm", triggerClassName)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {groupOrder.map((g) => {
          const items = UNIT_OPTIONS.filter((u) => u.group === g);
          if (items.length === 0) return null;
          return (
            <SelectGroup key={g}>
              <SelectLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">{g}</SelectLabel>
              {items.map((u) => (
                <SelectItem key={u.value} value={u.value}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
        {allowCustom && (
          <SelectGroup>
            <SelectItem value={CUSTOM_VALUE}>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Pencil className="h-3 w-3" /> Outra…
              </span>
            </SelectItem>
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}

export default UnitSelect;
