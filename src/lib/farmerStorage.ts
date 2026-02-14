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
 * Returns the public URL on success.
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

  const { data } = supabase.storage.from("farmer-media").getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Upload all photos and biometrics, returning the URL map.
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
      uploadFarmerMedia(farmerCode, "photos", key, dataUrl).then((url) => {
        photoUrls[key] = url;
      }),
    );
  }

  for (const [key, dataUrl] of Object.entries(biometrics)) {
    if (!dataUrl) continue;
    uploads.push(
      uploadFarmerMedia(farmerCode, "biometrics", key, dataUrl).then((url) => {
        biometricUrls[key] = url;
      }),
    );
  }

  await Promise.all(uploads);
  return { photoUrls, biometricUrls };
}
