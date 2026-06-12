import imageCompression from "browser-image-compression";

export async function compressImage(file: File | Blob): Promise<File> {
  const input = file instanceof File ? file : new File([file], "image.jpg", { type: "image/jpeg" });
  return imageCompression(input, {
    maxSizeMB: 0.05,       // 50 KB
    maxWidthOrHeight: 800,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.8,
  });
}
