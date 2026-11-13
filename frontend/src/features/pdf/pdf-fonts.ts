export type PdfFonts={regular:string;bold:string};
function binaryString(bytes:Uint8Array):string {
  const parts:string[]=[];
  for(let i=0;i<bytes.length;i+=8192)parts.push(String.fromCharCode(...bytes.subarray(i,i+8192)));
  return parts.join("");
}
export async function loadPdfFonts(signal:AbortSignal):Promise<PdfFonts>{
  const base=process.env.NEXT_PUBLIC_ASSET_BASE_PATH || "";
  const files=await Promise.all(["Regular","Bold"].map(async weight=>{
    const response=await fetch(`${base}/fonts/Lato-${weight}.ttf`,{signal,credentials:"same-origin"});
    if(!response.ok)throw new Error("Fontul PDF nu poate fi încărcat. Verifică conexiunea și încearcă din nou.");
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(bytes.length<1000 || bytes.length>2*1024*1024 || bytes[0]!==0 || bytes[1]!==1)throw new Error("Fișierul fontului PDF este invalid.");
    return btoa(binaryString(bytes));
  }));
  return {regular:files[0],bold:files[1]};
}
