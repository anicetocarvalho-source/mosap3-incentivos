import { Bell, Search, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const AppHeader = () => {
  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar agricultores, escolas..."
          className="pl-10 bg-muted border-0"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
            3
          </span>
        </Button>
        <div className="flex items-center gap-2 pl-3 border-l border-border">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
            <User className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="text-sm">
            <p className="font-semibold font-heading leading-none">Admin MOSAP3</p>
            <p className="text-muted-foreground text-xs">Administrador</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
