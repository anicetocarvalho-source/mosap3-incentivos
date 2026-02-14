import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to get a signed URL for a farmer-media storage path.
 * Handles both old public URLs (extracts path) and new storage paths.
 */
export function useFarmerMediaUrl(storedValue: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!storedValue) {
      setUrl(null);
      return;
    }

    // If it's already a full URL (old data), extract the storage path
    let path = storedValue;
    const bucketMarker = "/object/public/farmer-media/";
    const idx = storedValue.indexOf(bucketMarker);
    if (idx !== -1) {
      path = storedValue.substring(idx + bucketMarker.length);
    }

    let cancelled = false;
    supabase.storage
      .from("farmer-media")
      .createSignedUrl(path, 3600)
      .then(({ data, error }) => {
        if (!cancelled && data && !error) {
          setUrl(data.signedUrl);
        }
      });

    return () => { cancelled = true; };
  }, [storedValue]);

  return url;
}
