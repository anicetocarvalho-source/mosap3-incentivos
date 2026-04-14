import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  category: string;
  entity_type: string | null;
  entity_id: string | null;
  read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user, authReady } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user || !authReady) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      setNotifications(data as AppNotification[]);
      setUnreadCount(data.filter((n: any) => !n.read).length);
    }
    setLoading(false);
  }, [user, authReady]);

  // Mark as read
  const markAsRead = useCallback(async (notificationId: string) => {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, [user]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    await supabase.from("notifications").delete().eq("id", notificationId);
    setNotifications((prev) => {
      const n = prev.find((x) => x.id === notificationId);
      if (n && !n.read) setUnreadCount((c) => Math.max(0, c - 1));
      return prev.filter((x) => x.id !== notificationId);
    });
  }, []);

  // Initial fetch + realtime subscription
  useEffect(() => {
    if (!authReady) {
      setLoading(true);
      return;
    }

    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    fetchNotifications();

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as AppNotification;
          setNotifications((prev) => [newNotification, ...prev]);
          setUnreadCount((prev) => prev + 1);

          // Show browser notification if permission granted
          if (Notification.permission === "granted") {
            new window.Notification(newNotification.title, {
              body: newNotification.body,
              icon: "/pwa-192x192.png",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, authReady, fetchNotifications]);

  // Subscribe to push notifications
  const subscribeToPush = useCallback(async () => {
    if (!user || !authReady) return false;

    try {
      const permission = await window.Notification.requestPermission();
      if (permission !== "granted") return false;

      // Register push service worker
      const registration = await navigator.serviceWorker.register("/push-sw.js");
      await registration.update();

      // Get VAPID public key from system settings
      const { data: settings } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "vapid_public_key")
        .maybeSingle();

      if (!settings?.value) {
        console.warn("VAPID public key not configured");
        return false;
      }

      const vapidPublicKey = settings.value;

      // Convert VAPID key to Uint8Array
      const padding = "=".repeat((4 - (vapidPublicKey.length % 4)) % 4);
      const base64 = (vapidPublicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
      const rawData = atob(base64);
      const applicationServerKey = new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));

      const subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const subJson = subscription.toJSON();

      // Store subscription in DB
      await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: subJson.endpoint!,
          p256dh: subJson.keys!.p256dh!,
          auth: subJson.keys!.auth!,
        },
        { onConflict: "user_id,endpoint" }
      );

      return true;
    } catch (error) {
      console.error("Push subscription failed:", error);
      return false;
    }
  }, [user, authReady]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    subscribeToPush,
  };
}
