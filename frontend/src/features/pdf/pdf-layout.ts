import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { PdfFonts } from "./pdf-fonts";
import type { PdfDocumentData } from "./pdf-data";
import { formatExactDecimal } from "../furniture/calculate-wardrobe";
import { formatMoney } from "../furniture/wardrobe-pricing";
import { createWardrobeLayout, previewViewport } from "../furniture/wardrobe-preview-geometry";
import { edgeLabels } from "../manufacturing/manufacturing-model";
import { describeRule, roundingLabels } from "../manufacturing/manufacturing-display";

const ink="#22201E",muted="#68625B",accent="#EAD9C9";
export const documentTitle=(data:PdfDocumentData)=>data.kind==="quotation" ? "Deviz estimativ":data.manufacturing ? "Fișă tehnică de verificare":"Fișă tehnică de execuție";
export const localDate=(date:string)=>new Intl.DateTimeFormat("ro-RO",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"Europe/Bucharest"}).format(new Date(date));

/** Shared print layout. All numbers come from the prepared DTO, not PDF formulas. */
export class PdfLayout {
  readonly doc:jsPDF;
  y=26;
  constructor(fonts:PdfFonts,readonly data:PdfDocumentData){
    this.doc=new jsPDF({orientation:"portrait",unit:"mm",format:"a4",compress:true,putOnlyUsedFonts:true});
    for(const [style,bytes] of [["normal",fonts.regular],["bold",fonts.bold]]){
      this.doc.addFileToVFS(`Lato-${style}.ttf`,bytes);this.doc.addFont(`Lato-${style}.ttf`,"Lato",style);
    }
    this.doc.setFont("Lato","normal");this.doc.setTextColor(ink);this.doc.setCreationDate(new Date(data.identity.generated_at));
    this.doc.setProperties({title:documentTitle(data),subject:`${data.identity.project_name} | ${data.kind} | ${data.identity.generated_at}`,author:"FORMA",creator:"FORMA",keywords:`FORMA,${data.kind},${data.identity.reference}`});
  }
  space(height:number){if(this.y+height>273){this.doc.addPage();this.y=26;}}
  text(value:string,size=10,color=ink,width=174,bold=false){
    if(!value)return;
    this.doc.setFont("Lato",bold ? "bold":"normal");this.doc.setFontSize(size);this.doc.setTextColor(color);
    const lines=this.doc.splitTextToSize(value,width) as string[];
    const lineHeight=size*.352778*1.4;
    for(const line of lines){this.space(lineHeight);this.doc.text(line,18,this.y);this.y+=lineHeight;}
  }
  gap(mm=5){this.y+=mm;}
  heading(value:string){this.space(35);this.gap(6);this.text(value,13,ink,174,true);this.gap(2);}
  companyHeader(){
    const company=this.data.company,top=this.y;
    this.text(company.display_name,21,ink,company.logo ? 130:174,true);
    if(company.logo){const logo=company.logo,scale=Math.min(32/logo.width,24/logo.height);this.doc.addImage(logo.data_url,logo.format,160,top-5,logo.width*scale,logo.height*scale,undefined,"FAST");this.y=Math.max(this.y,top+22);}
    for(const line of [company.contact_person,company.phone,company.email,company.address,company.website,
      company.registration_info ? `Înregistrare: ${company.registration_info}`:"",company.tax_info ? `Identificare fiscală: ${company.tax_info}`:""])this.text(line,9,muted);
    this.gap(6);this.space(12);this.doc.setDrawColor(accent);this.doc.setLineWidth(.4);this.doc.line(18,this.y,192,this.y);this.gap(10);
  }
  identification(){
    this.text(documentTitle(this.data),24,ink,174,true);this.gap(4);
    this.text(this.data.identity.project_name,15,ink,174,true);this.gap(3);
    this.text(`Referință: ${this.data.identity.reference}`,9,muted);
    if(this.data.identity.project_id)this.text(`ID proiect: ${this.data.identity.project_id}`,8,muted);
    else this.text("Proiect nesalvat - export din configurația curentă",9,muted);
    this.text(`Generat la: ${localDate(this.data.identity.generated_at)}`,9,muted);
    this.gap(6);
    const c=this.data.configuration;
    this.text(`Dulap PAL | ${c.width_mm} × ${c.height_mm} × ${c.depth_mm} mm`,12,ink,174,true);
    this.text(`Lățime × înălțime × ${this.data.kind==="workshop" && this.data.manufacturing ? "adâncime carcasă":"adâncime"}. ${c.doors_count} uși; ${c.shelves_count} polițe.`,10,muted);
  }
  table(head:string[],body:string[][],widths?:number[]){
    this.space(22);
    autoTable(this.doc,{startY:this.y,head:[head],body,theme:"plain",showHead:"everyPage",rowPageBreak:"avoid",
      margin:{left:18,right:18,top:26,bottom:24},styles:{font:"Lato",fontStyle:"normal",fontSize:8,cellPadding:2.4,overflow:"linebreak",textColor:ink,lineColor:"#E9E4DE",lineWidth:{bottom:.2}},
      headStyles:{font:"Lato",fontStyle:"bold",fontSize:8,fillColor:accent,textColor:ink},alternateRowStyles:{fillColor:"#F8F7F4"},
      columnStyles:widths ? Object.fromEntries(widths.map((width,index)=>[index,{cellWidth:width}])):{},
    });
    this.y=(this.doc as jsPDF & {lastAutoTable:{finalY:number}}).lastAutoTable.finalY+5;
  }
  drawing(){
    this.heading("Vedere frontală cotată");this.space(112);
    const top=this.y,scale=.26;
    (["interior","doors"] as const).forEach((mode,index)=>{
      const c=this.data.configuration;
      const layout=createWardrobeLayout({widthMm:c.width_mm,heightMm:c.height_mm,depthMm:c.depth_mm,doorsCount:c.doors_count,shelvesCount:c.shelves_count,viewMode:mode});
      if(!layout)throw new Error("Desenul configurației confirmate nu poate fi generat.");
      // Uniform scale of the existing shared SVG geometry; no material formulas.
      const x0=11+index*88,y0=top;
      const x=(v:number)=>x0+v*scale,y=(v:number)=>y0+v*scale;
      const rectangle=(r:{x:number;y:number;width:number;height:number},fill:string)=>{this.doc.setFillColor(fill);this.doc.setDrawColor("#817C75");this.doc.setLineWidth(.2);this.doc.rect(x(r.x),y(r.y),r.width*scale,r.height*scale,"FD");};
      rectangle(layout.outline,"#F8F7F4");layout.panels.forEach(r=>rectangle(r,accent));layout.shelves.forEach(r=>rectangle(r,accent));
      layout.doors.forEach(r=>{rectangle(r,"#F0E8DF");this.doc.setDrawColor(ink);this.doc.line(x(r.handleX),y(r.handleY),x(r.handleX),y(r.handleY+r.handleLength));});
      const o=layout.outline,right=o.x+o.width,bottom=o.y+o.height,dy=layout.widthDimensionY,hx=layout.heightDimensionX;
      this.doc.setDrawColor(muted);this.doc.setLineWidth(.2);
      const line=(a:number,b:number,c:number,d:number)=>this.doc.line(x(a),y(b),x(c),y(d));
      line(o.x,bottom+5,o.x,dy+5);line(right,bottom+5,right,dy+5);line(o.x,dy,right,dy);
      line(o.x-3,dy+3,o.x+3,dy-3);line(right-3,dy+3,right+3,dy-3);
      line(o.x-5,o.y,hx-5,o.y);line(o.x-5,bottom,hx-5,bottom);line(hx,o.y,hx,bottom);
      line(hx-3,o.y+3,hx+3,o.y-3);line(hx-3,bottom+3,hx+3,bottom-3);
      this.doc.setFont("Lato","normal");this.doc.setFontSize(8);this.doc.setTextColor(ink);
      this.doc.text(`${c.width_mm} mm`,x(o.x+o.width/2),y(dy+20),{align:"center"});
      this.doc.text(`${c.height_mm} mm`,x(hx-13),y(o.y+o.height/2),{angle:90,align:"center"});
      this.doc.text(mode==="interior" ? `Interior - ${c.shelves_count} polițe`:`Front - ${c.doors_count} uși`,x(previewViewport.width/2),top+111,{align:"center"});
    });
    this.y=top+119;this.text(`Adâncime: ${this.data.configuration.depth_mm} mm. Grosimile din desen sunt schematice; cotele și tabelul prevalează.`,9,muted);
  }
  quotation(){
    if(this.data.kind!=="quotation")throw new Error("Tip de document incompatibil.");
    this.heading("Oferta pentru proiectul tău");
    this.table(["Descriere","Preț estimativ fără TVA"],[["Dulap conform configurației de mai sus",formatMoney(this.data.selling_price_ron)]],[112,62]);
    this.text("Monedă: RON. TVA nu este calculat sau adăugat. Tratamentul fiscal trebuie verificat separat.",10,muted);
    if(this.data.valid_until)this.text(`Valabil până la ${localDate(this.data.valid_until)} (${this.data.company.validity_days} zile de la generare).`,10);
    if(this.data.company.quotation_notes){this.heading("Note și condiții");this.text(this.data.company.quotation_notes);}
    this.heading("Document estimativ");this.text("Acest deviz este o estimare, nu o factură fiscală și nu reprezintă un angajament contractual. Configurația, materialele și condițiile finale se confirmă înainte de comandă.",10,muted);
  }
  workshop(){
    if(this.data.kind!=="workshop")throw new Error("Tip de document incompatibil.");
    const result=this.data.calculation,decimal=formatExactDecimal;
    if(this.data.manufacturing)this.manufacturingSummary();
    this.drawing();
    this.heading("Lista de debitare");
    if(this.data.manufacturing)this.text("Tabel nominal / finit pentru baza financiară. Cotele brute calculate sunt prezentate separat; nu folosi dimensiunile finite ca ordin brut de debitare.",9,muted);
    this.text(`PAL net: ${decimal(result.totals.total_pal_area_m2)} m² | HDF net: ${decimal(result.totals.total_hdf_area_m2)} m² | Piese: ${result.totals.total_panel_count}`,10);
    const bandLabel={none:"fără ABS",abs_2:"ABS 2 mm",abs_0_4:"ABS 0,4 mm"};
    const edgeLabel={length_start:"L început",length_end:"L sfârșit",width_start:"l început (față)",width_end:"l sfârșit"};
    this.table(["Piesă","Material","L × l (mm)","Gros. mm","Buc.","Canturi"],result.panels.map(p=>[p.name,p.material,`${decimal(p.length_mm)} × ${decimal(p.width_mm)}`,decimal(p.thickness_mm),String(p.quantity),p.edges ? Object.entries(p.edges).filter(([,band])=>band!=="none").map(([edge,band])=>`${edgeLabel[edge as keyof typeof edgeLabel]}: ${bandLabel[band]}`).join("; ") || "Fără ABS":"Nu se aplică"]),[31,18,29,18,13,65]);
    this.heading("Cant ABS - lungimi nete");
    this.table(["Tip","Lungime netă"],[["ABS 2 mm",`${decimal(result.edge_banding.totals_by_type.abs_2_total_m)} m`],["ABS 0,4 mm",`${decimal(result.edge_banding.totals_by_type.abs_0_4_total_m)} m`]]);
    this.text(result.edge_banding.edge_convention,9,muted);
    this.table(["Piesă / latură","Tip","Latură mm","Total net m"],result.edge_banding.panel_edges.flatMap(p=>p.edges.map(e=>[`${p.name} / ${e.name}`,bandLabel[e.banding_type],decimal(e.length_mm),decimal(e.total_net_length_m)])),[79,32,30,33]);
    this.heading("Feronerie");
    this.table(["Articol","Cantitate","Regulă / observație"],result.hardware.items.map(h=>[h.name,`${h.quantity} ${h.unit}`,`${h.calculation_rule}${h.is_estimate ? " (estimare preliminară)":""}`]),[44,25,105]);
    this.heading("Ipoteze și verificări înainte de execuție");
    this.text(`Profil constructiv: ${result.construction_profile.name} (${result.construction_profile.id})`,9);
    const notes=Array.from(new Set([...result.construction_profile.assumptions,...result.edge_banding.assumptions,...result.hardware.assumptions,...result.warnings]));
    notes.forEach(note=>{this.text(`- ${note}`,9,muted);this.gap(2);});
    this.text("Document tehnic estimativ. Dimensiunile și soluțiile constructive trebuie verificate înainte de debitare și execuție.",10,ink,174,true);
    this.text("Desen schematic, fără poziții de găurire proiectate. Documentul nu este un plan de fabricație certificat. Nu include optimizarea plăcilor.",9,muted);
  }
  manufacturingSummary(){
    if(this.data.kind!=="workshop" || !this.data.manufacturing)return;
    const {snapshot,result}=this.data.manufacturing,profile=snapshot.profile;
    this.heading("Prelucrare - dimensiuni finite și brute");
    this.text(`${profile.name} | schema v${profile.schema_version}, revizia ${profile.revision}`,11,ink,174,true);
    this.text(`Profil dimensional: ${snapshot.dimensional_profile_id} / ${snapshot.calculation_version}`,8,muted);
    this.text(`ID proces: ${profile.id} | Furnizor/atelier: ${snapshot.supplier_name_at_selection || (profile.supplier_id ? "referință indisponibilă":"atelier independent")}`,9);
    this.text(`Stare setări la selectare: ${{draft:"ciornă",validated:"validate",archived:"arhivate"}[snapshot.approval_status]}. Furnizor: ${{standalone:"atelier independent",active:"activ",archived:"arhivat",missing:"indisponibil"}[snapshot.supplier_status_at_selection]}.`,9,muted);
    this.text(`Fabricație: ${result.readiness==="calculation_ready_unverified" ? "Calculabil - neverificat în atelier":"Configurare incompletă"}. Fără aprobare fizică de execuție.`,10,ink,174,true);
    this.text("Dimensiuni brute neconfirmate — verificare în atelier necesară.",10,ink,174,true);
    this.text(`Adâncime carcasă: ${result.carcass_depth_mm} mm | proiecție spate: ${result.back_projection_mm ?? "neconfigurată"} mm | front: ${result.front_projection_mm ?? "neconfigurată"} mm.`,9);
    this.text(result.overall_depth_mm===null ? "Adâncime totală neconfigurată":`Adâncime totală calculată: ${result.overall_depth_mm} mm - verificare fizică necesară.`,10);
    this.text(`Pas debitare: ${profile.cutting_precision_mm ?? "neconfigurat"} mm | rotunjire: ${profile.rounding_policy ? roundingLabels[profile.rounding_policy]:"neconfigurată"} | toleranță: ${profile.dimensional_tolerance_mm ?? "neconfigurată"} mm.`,9);
    this.table(["Piesă / buc.","Finit L × l mm","Brut exact L × l mm","Cotă la pas L × l mm"],result.panels.map(p=>[
      `${p.name} / ${p.quantity}`,`${p.finished_length_mm} × ${p.finished_width_mm}`,
      `${p.raw_length_mm ?? "?"} × ${p.raw_width_mm ?? "?"}`,`${p.cutting_length_mm ?? "neconfigurat"} × ${p.cutting_width_mm ?? "neconfigurat"}`]),[40,40,44,50]);
    this.text("Muchii locale panou: sus/jos sunt capetele axei L; stânga/dreapta sunt capetele axei l. Orientarea fibrei rămâne nespecificată.",9,muted);
    this.table(["Cant","Regulă dimensională"],Object.entries(profile.edge_processing_rules).map(([edge,rule])=>[
      edgeLabels[edge as keyof typeof edgeLabels],describeRule(rule)]),[40,134]);
    this.table(["Piesă","Sus / jos / stânga / dreapta"],result.panels.map(p=>[p.name,[p.edges.top,p.edges.bottom,p.edges.left,p.edges.right].map(edge=>edge==="none" ? "fără cant":edgeLabels[edge]).join(" / ")]),[40,134]);
    [...result.issues,...result.warnings].forEach(warning=>this.text(`- ${warning}`,9,muted));
    if(profile.notes){this.heading("Note proces");this.text(profile.notes,9);}
  }
  finish():jsPDF {
    const total=this.doc.getNumberOfPages();
    for(let page=1;page<=total;page++){
      this.doc.setPage(page);this.doc.setFont("Lato","normal");this.doc.setFontSize(8);this.doc.setTextColor(muted);
      this.doc.text(`FORMA / ${documentTitle(this.data)}`,18,13);
      this.doc.setDrawColor(accent);this.doc.line(18,280,192,280);
      this.doc.text(`${localDate(this.data.identity.generated_at)} | Generat cu FORMA`,18,286);
      this.doc.text(`Pagina ${page} din ${total}`,192,286,{align:"right"});
    }
    return this.doc;
  }
}
