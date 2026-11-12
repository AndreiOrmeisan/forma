import { isMockInterpretation, type MockInterpretation } from "./wardrobe-configuration";
import { detectImageType } from "@/components/image-upload/validate-image";

export async function analyzeSketch(file: File, signal: AbortSignal): Promise<MockInterpretation> {
  const formData = new FormData();
  // A browser may leave the MIME type empty. Validation already checked its signature.
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const type = file.type || detectImageType(header);
  if (!type) throw new Error("Formatul imaginii nu este acceptat. Selectează din nou fotografia.");
  formData.append("file", new Blob([file], { type }), file.name);
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/furniture/analyze-sketch`, {
      method: "POST", body: formData, signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error("Nu putem contacta serverul local. Verifică dacă backend-ul este pornit și încearcă din nou.");
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(typeof data?.detail === "string" ? data.detail : "Datele demonstrative nu pot fi încărcate. Încearcă din nou.");
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("Răspunsul serverului nu poate fi citit. Încearcă din nou.");
  }
  if (!isMockInterpretation(data)) {
    throw new Error("Serverul a returnat o configurație demonstrativă nevalidă. Încearcă din nou.");
  }
  return data;
}
