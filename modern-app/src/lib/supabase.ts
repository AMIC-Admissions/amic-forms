import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Upload a PDF Blob to the signed-pdfs bucket.
 * Returns a signed URL (valid 1 year) or null on failure.
 */
export async function uploadSignedPDF(
  refNum: string,
  filename: string,
  pdfBlob: Blob
): Promise<string | null> {
  const path = `${refNum}/${filename}-signed.pdf`;
  const { error } = await supabase.storage
    .from('signed-pdfs')
    .upload(path, pdfBlob, { contentType: 'application/pdf', upsert: true });
  if (error) {
    console.warn('[storage] signed-pdf upload failed:', error.message);
    return null;
  }
  const { data } = await supabase.storage
    .from('signed-pdfs')
    .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year
  return data?.signedUrl ?? null;
}

/**
 * Upload an attachment File to the attachments bucket.
 * Returns a signed URL (valid 1 year) or null on failure.
 */
export async function uploadAttachment(
  refNum: string,
  slotId: string,
  file: File
): Promise<string | null> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${refNum}/${slotId}/${safeName}`;
  const { error } = await supabase.storage
    .from('attachments')
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) {
    console.warn('[storage] attachment upload failed:', error.message);
    return null;
  }
  const { data } = await supabase.storage
    .from('attachments')
    .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year
  return data?.signedUrl ?? null;
}

/**
 * Get a fresh signed URL for an existing storage object path.
 * bucket: 'signed-pdfs' | 'attachments'
 */
export async function getSignedUrl(
  bucket: 'signed-pdfs' | 'attachments',
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}
