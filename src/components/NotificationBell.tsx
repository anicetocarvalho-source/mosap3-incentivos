import { useState } from "react";
import { Bell, Check, CheckCheck, Trash2, BellRing, Wheat, Gift, MapPin, User, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";
import { toast } from "sonner";

const categoryIcons: Record<string, any> = {
  agricultores: User,
  incentivos: Gift,
  transacoes: ShoppingCart,
  producao: Wheat,
  parcelas: MapPin,
  sistema: Bell,
};

const categoryColors: Record<string, string> = {
  agricultores: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  incentivos: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  transacoes: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  producao: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  parcelas: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  sistema: "bg-muted text-muted-foreground",
};

const NotificationBell = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, subscribeToPush } = useNotifications();
  const [open, setOpen] = useState(false);

  const handleEnablePush = async () => {
    const result = await subscribeToPush();
    if (result) {
      toast.success("Notificações push activadas!");
    } else {
      toast.error("Não foi possível activar as notificações push. Verifique as permissões do browser.");
    }
  };

  const timeAgo = (date: string) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true, locale: pt });
    } catch {
      return "";
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-heading font-semibold text-sm">Notificações</h3>
          <div className="flex items-center gap-1">
            {window.Notification && Notification.permission !== "granted" && (
              <Button variant="ghost" size="sm" className="text-xs gap-1 h-7" onClick={handleEnablePush}>
                <BellRing className="h-3 w-3" /> Push
              </Button>
            )}
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs gap-1 h-7" onClick={markAllAsRead}>
                <CheckCheck className="h-3 w-3" /> Marcar tudo
              </Button>
            )}
          </div>
        </div>

        {/* Notifications list */}
        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Sem notificações</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  timeAgo={timeAgo(n.created_at)}
                  onRead={() => markAsRead(n.id)}
                  onDelete={() => deleteNotification(n.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

function NotificationItem({
  notification,
  timeAgo,
  onRead,
  onDelete,
}: {
  notification: AppNotification;
  timeAgo: string;
  onRead: () => void;
  onDelete: () => void;
}) {
  const Icon = categoryIcons[notification.category] || Bell;
  const colorClass = categoryColors[notification.category] || categoryColors.sistema;

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer ${
        !notification.read ? "bg-primary/5" : ""
      }`}
      onClick={() => {
        if (!notification.read) onRead();
      }}
    >
      <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${colorClass}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm leading-tight ${!notification.read ? "font-semibold" : "font-medium"}`}>
            {notification.title}
          </p>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {!notification.read && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onRead(); }} title="Marcar como lida">
                <Check className="h-3 w-3" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Apagar">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.body}</p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo}</p>
      </div>
    </div>
  );
}

export default NotificationBell;
