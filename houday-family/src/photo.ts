// 連絡帳の写真を、文字が読める程度に縮小して保存する（端末の容量とバックアップの大きさを抑える）

const MAX_EDGE = 1600;
const QUALITY = 0.8;

export async function compressPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('写真を読み込めませんでした');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('写真を保存できませんでした'))), 'image/jpeg', QUALITY);
  });
}
