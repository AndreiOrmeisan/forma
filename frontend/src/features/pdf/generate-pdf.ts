import type { PdfDocumentData } from "./pdf-data";
import type { PdfFonts } from "./pdf-fonts";
import { PdfLayout } from "./pdf-layout";

export function generatePdf(data:PdfDocumentData,fonts:PdfFonts):ArrayBuffer {
  try{
    const layout=new PdfLayout(fonts,data);
    layout.companyHeader();layout.identification();
    if(data.kind==="quotation")layout.quotation();else layout.workshop();
    return layout.finish().output("arraybuffer");
  }catch{
    throw new Error("PDF-ul nu a putut fi generat. Verifică datele firmei și logo-ul sau încearcă fără logo.");
  }
}
