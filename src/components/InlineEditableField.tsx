import { useState, useRef, useEffect } from "react";
import { Check, X, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

interface Props {
  label: string;
  value: string;
  onSave: (newValue: string) => Promise<void>;
  type?: "text" | "select" | "date";
  options?: Option[];
  mono?: boolean;
  placeholder?: string;
}

const InlineEditableField = ({ label, value, onSave, type = "text", options, mono, placeholder }: Props) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  useEffect(() => { setDraft(value); }, [value]);

  const handleSave = async () => {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch {
      setDraft(value);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => { setDraft(value); setEditing(false); };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  };

  if (editing) {
    return (
      <div className="space-y-1">
        <p className="text-[10px] md:text-xs text-muted-foreground font-medium">{label}</p>
        <div className="flex items-center gap-1">
          {type === "select" && options ? (
            <Select value={draft} onValueChange={(v) => { setDraft(v); }}>
              <SelectTrigger className="h-7 text-xs w-full">
                <SelectValue placeholder={placeholder || "Selecionar"} />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              ref={inputRef}
              type={type === "date" ? "date" : "text"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-7 text-xs"
              placeholder={placeholder}
            />
          )}
          <button onClick={handleSave} disabled={saving} className="p-1 rounded hover:bg-primary/10 text-primary flex-shrink-0">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={handleCancel} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground flex-shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group cursor-pointer" onClick={() => setEditing(true)}>
      <p className="text-[10px] md:text-xs text-muted-foreground font-medium">{label}</p>
      <div className="flex items-center gap-1 mt-0.5">
        <p className={cn(
          "text-xs md:text-sm font-semibold truncate",
          mono && "font-mono"
        )}>
          {value || "—"}
        </p>
        <Pencil className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors flex-shrink-0" />
      </div>
    </div>
  );
};

export default InlineEditableField;
