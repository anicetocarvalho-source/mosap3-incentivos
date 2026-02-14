import { supabase } from "@/integrations/supabase/client";

/**
 * Convert a base64 data URL to a Blob for uploading
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Upload a base64 image to the farmer-media bucket.
 * Returns the storage path (not a public URL since bucket is private).
 */
export async function uploadFarmerMedia(
  farmerCode: string,
  category: "photos" | "biometrics",
  key: string,
  dataUrl: string,
): Promise<string> {
  const ext = dataUrl.startsWith("data:image/png") ? "png" : "jpg";
  const path = `${farmerCode}/${category}/${key}.${ext}`;
  const blob = dataUrlToBlob(dataUrl);

  const { error } = await supabase.storage
    .from("farmer-media")
    .upload(path, blob, { upsert: true, contentType: blob.type });

  if (error) throw error;

  // Return the storage path; use getSignedUrl when displaying
  return path;
}

/**
 * Get a signed URL for a farmer media file (1 hour expiry).
 */
export async function getFarmerMediaSignedUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("farmer-media")
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

/**
 * Upload all photos and biometrics, returning the path map.
 */
export async function uploadAllFarmerMedia(
  farmerCode: string,
  photos: Record<string, string>,
  biometrics: Record<string, string>,
): Promise<{
  photoUrls: Record<string, string>;
  biometricUrls: Record<string, string>;
}> {
  const photoUrls: Record<string, string> = {};
  const biometricUrls: Record<string, string> = {};

  const uploads: Promise<void>[] = [];

  for (const [key, dataUrl] of Object.entries(photos)) {
    if (!dataUrl) continue;
    uploads.push(
      uploadFarmerMedia(farmerCode, "photos", key, dataUrl).then((path) => {
        photoUrls[key] = path;
      }),
    );
  }

  for (const [key, dataUrl] of Object.entries(biometrics)) {
    if (!dataUrl) continue;
    uploads.push(
      uploadFarmerMedia(farmerCode, "biometrics", key, dataUrl).then((path) => {
        biometricUrls[key] = path;
      }),
    );
  }

  await Promise.all(uploads);
  return { photoUrls, biometricUrls };
}
