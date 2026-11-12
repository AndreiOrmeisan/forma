import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTypeScriptModule } from "./helpers/load-typescript.mjs";

const pricing = loadTypeScriptModule("src/features/furniture/wardrobe-pricing.ts");
const configuration = {width_mm:800,height_mm:2000,depth_mm:600,doors_count:2,shelves_count:3,furniture_type:"wardrobe"};

test("empty prices remain missing and explicit zero is included", () => {
  const draft = pricing.initialPricing();
  assert.equal(pricing.pricingPayload(configuration, draft).price_catalog.length, 0);
  draft.pal_18 = "0";
  draft.hinges = "1,25";
  const request = pricing.pricingPayload(configuration, draft);
  assert.equal(request.price_catalog[0].unit_price_ron, "0");
  assert.equal(request.price_catalog[1].unit_price_ron, "1.25");
  assert.equal(request.waste_allowances.pal, "0");
  assert.equal(request.confirmed, true);
  assert.ok(!("quantities" in request));
});

test("price editing validates finite nonnegative values and percentage limits", () => {
  for (const value of ["", "-1", "NaN", "Infinity", "1e3", "1.1234567", "1000000001"]) assert.ok(pricing.pricingError(value));
  for (const value of ["0", "1,25", "100.123456"]) assert.equal(pricing.pricingError(value), null);
  assert.ok(pricing.pricingError("100.1", true));
  assert.equal(pricing.pricingError("100", true), null);
});

test("backend estimate renders complete totals and missing prices without a selling price", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/wardrobe-estimate.json", import.meta.url), "utf8"));
  const {EstimateDetails} = loadTypeScriptModule("src/features/furniture/wardrobe-pricing-form.tsx", {"./wardrobe-project-context": {useWardrobeProject:()=>({})}});
  assert.equal(pricing.isEstimate(fixture), true);
  const complete = renderToStaticMarkup(React.createElement(EstimateDetails, {estimate:fixture}));
  assert.match(complete, /951,54 RON/);
  assert.match(complete, /fără TVA/);
  fixture.is_complete = false;
  fixture.missing_item_codes = ["pal_18"];
  fixture.selling_price_before_tax_ron = null;
  fixture.material_lines[0].unit_price_ron = null;
  fixture.material_lines[0].line_total_ron = null;
  const incomplete = renderToStaticMarkup(React.createElement(EstimateDetails, {estimate:fixture}));
  assert.match(incomplete, /Deviz incomplet/);
  assert.match(incomplete, /Necompletat/);
  fixture.is_complete = true;
  assert.equal(pricing.isEstimate(fixture), false);
  assert.equal(pricing.formatMoney("100.005"), "100,01 RON");
});

test("pricing form renders accessible empty fields and explicit apply behavior", () => {
  const {WardrobePricingForm} = loadTypeScriptModule("src/features/furniture/wardrobe-pricing-form.tsx", {
    "./wardrobe-project-context": {useWardrobeProject: () => ({pricing:pricing.initialPricing(),updatePricing:()=>{}})},
  });
  const html = renderToStaticMarkup(React.createElement(WardrobePricingForm, {configuration}));
  assert.match(html, /Aplică prețurile și generează devizul/);
  assert.match(html, /Prețuri feronerie/);
  assert.match(html, /inputMode="decimal"/);
  assert.match(html, /placeholder="Necompletat"/);
  assert.match(html, /Pierderi materiale/);
  assert.ok(!html.includes("<details open"));
});
