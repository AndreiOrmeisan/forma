// Synthetic QA artifacts only; output/pdf is ignored by Git.
// First run backend/tests/generate_manufacturing_samples.py from backend/.
import {readFileSync, writeFileSync, mkdirSync} from "node:fs";
import {loadTypeScriptModule as load} from "./helpers/load-typescript.mjs";

const {preparePdfData} = load("src/features/pdf/pdf-data.ts");
const {generatePdf} = load("src/features/pdf/generate-pdf.ts");
const {emptyCompanyProfile} = load("src/features/company/company-profile.ts");
const samples = JSON.parse(readFileSync("../output/pdf/manufacturing-synthetic.json", "utf8"));
const calculation = JSON.parse(readFileSync("tests/fixtures/wardrobe-calculation.json", "utf8"));
const fonts = {regular: readFileSync("public/fonts/Lato-Regular.ttf").toString("base64"), bold: readFileSync("public/fonts/Lato-Bold.ttf").toString("base64")};
mkdirSync("../output/pdf", {recursive: true});
for (const [name, sample] of Object.entries(samples)) {
  const document = preparePdfData({kind: "workshop", company: {...emptyCompanyProfile(), display_name: "Atelier sintetic · control PDF ă â î ș ț"},
    configuration: calculation.input_configuration, calculation, estimate: null, projectName: `Dulap sintetic · profil ${name}`, projectId: null,
    generatedAt: "2026-11-13T12:00:00Z", referenceId: "SYNTHETIC", manufacturingSnapshot: sample.snapshot, manufacturingResult: sample.result});
  const buffer = generatePdf(document, fonts);
  const file = `../output/pdf/manufacturing-${name}.pdf`;
  writeFileSync(file, Buffer.from(buffer)); console.log(`${file}: ${buffer.byteLength} bytes`);
}
