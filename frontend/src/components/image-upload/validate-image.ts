export type ValidatedImage = {
  file: File;
  url: string;
  width: number;
  height: number;
};

export const maxImageBytes = 10 * 1024 * 1024;
const supportedTypes = ["image/jpeg", "image/png", "image/webp"];
const formatError = "Format neacceptat. Alege o imagine JPEG, PNG sau WebP. Pentru HEIC, exportă mai întâi fotografia ca JPEG.";

function detectImageType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (pngSignature.every((value, index) => bytes[index] === value)) {
    return "image/png";
  }
  const text = String.fromCharCode(...bytes);
  if (text.startsWith("RIFF") && text.slice(8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

function decodeImage(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = window.setTimeout(() => {
      image.src = "";
      reject(new Error("Citirea imaginii durează prea mult. Încearcă o altă fotografie."));
    }, 15000);

    image.onload = () => {
      window.clearTimeout(timer);
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error("Imaginea nu poate fi citită. Alege o altă fotografie."));
        return;
      }
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("Imaginea este deteriorată sau nu poate fi citită. Alege o altă fotografie."));
    };
    image.src = url;
  });
}

export async function validateImage(file: File): Promise<ValidatedImage> {
  if (file.size === 0) {
    throw new Error("Fișierul este gol. Alege o altă imagine.");
  }
  if (file.size > maxImageBytes) {
    throw new Error("Imaginea depășește limita de 10 MB. Alege o fotografie mai mică.");
  }
  if (file.type && !supportedTypes.includes(file.type)) {
    throw new Error(formatError);
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  } catch {
    throw new Error("Fișierul nu poate fi citit. Selectează din nou fotografia.");
  }
  const detectedType = detectImageType(bytes);
  if (!detectedType || (file.type && file.type !== detectedType)) {
    throw new Error(formatError);
  }

  const url = URL.createObjectURL(file);
  try {
    const dimensions = await decodeImage(url);
    return { file, url, ...dimensions };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}
