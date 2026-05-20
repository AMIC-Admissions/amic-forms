export function generateReferenceNumber(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `AMIC-${num}`;
}

export function formatDate(dateStr: string, lang: 'en' | 'ar'): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getTodayString(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function downloadDataURL(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/**
 * Download a file from any URL (Storage signed URL or data URL).
 * For Storage URLs, fetches the blob first to force a download dialog.
 */
export async function downloadFromUrl(url: string, filename: string): Promise<void> {
  if (url.startsWith('data:')) {
    downloadDataURL(url, filename);
    return;
  }
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
  } catch {
    // Fallback: open in new tab
    window.open(url, '_blank');
  }
}

export function buildWhatsAppLink(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
