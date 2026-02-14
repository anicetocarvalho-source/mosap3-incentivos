import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCachedData, setCachedData, isCacheFresh } from "@/lib/offlineDb";
import { useOnlineStatus } from "./useOnlineStatus";

interface UseOfflineQueryOptions<T> {
  table: string;
  cacheKey: string;
  /** Supabase select columns */
  select?: string;
  /** Filter: { column, value } */
  filter?: { column: string; value: string };
  /** Order by column */
  orderBy?: { column: string; ascending?: boolean };
  /** Transform raw data */
  transform?: (data: any[]) => T[];
  /** Enable/disable the query */
  enabled?: boolean;
}

interface UseOfflineQueryResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  isFromCache: boolean;
  refetch: () => Promise<void>;
}

export function useOfflineQuery<T = any>(
  options: UseOfflineQueryOptions<T>
): UseOfflineQueryResult<T> {
  const { table, cacheKey, select = "*", filter, orderBy, transform, enabled = true } = options;
  const isOnline = useOnlineStatus();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);

    // If online, try fetching from Supabase
    if (isOnline) {
      try {
        let query = (supabase.from as any)(table).select(select);
        if (filter) {
          query = query.eq(filter.column, filter.value);
        }
        if (orderBy) {
          query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
        }
        const { data: result, error: fetchError } = await query;
        if (fetchError) throw fetchError;

        const rows = result || [];
        // Cache the result
        await setCachedData(table, cacheKey, rows);

        const transformed = transform ? transform(rows) : rows;
        setData(transformed);
        setIsFromCache(false);
        setLoading(false);
        return;
      } catch (err: any) {
        // Online fetch failed — fall through to cache
        console.warn(`Online fetch failed for ${table}, falling back to cache:`, err.message);
      }
    }

    // Offline or fetch failed — use cache
    try {
      const cached = await getCachedData(table, cacheKey);
      if (cached) {
        const transformed = transform ? transform(cached as any[]) : (cached as T[]);
        setData(transformed);
        setIsFromCache(true);
      } else {
        setData([]);
        setIsFromCache(false);
        if (!isOnline) {
          setError("Sem dados em cache. Conecte-se à internet para carregar.");
        }
      }
    } catch {
      setData([]);
    }
    setLoading(false);
  }, [table, cacheKey, select, filter?.column, filter?.value, orderBy?.column, isOnline, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh when sync completes
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("mosap3-sync", handler);
    return () => window.removeEventListener("mosap3-sync", handler);
  }, [fetchData]);

  return { data, loading, error, isFromCache, refetch: fetchData };
}
