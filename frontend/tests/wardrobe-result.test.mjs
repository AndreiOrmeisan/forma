import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTypeScriptModule } from "./helpers/load-typescript.mjs";

let image = null;
let confirmed = null;
const { WardrobeResult } = loadTypeScriptModule("src/app/domenii/mobilier/proiect-nou/rezultat/wardrobe-result.tsx", {
  "@/components/image-upload/image-draft-context": { useImageDraft: () => ({ image }) },
  "@/features/furniture/wardrobe-project-context": { useWardrobeProject: () => ({ confirmed }) },
  "@/features/furniture/wardrobe-configuration": loadTypeScriptModule("src/features/furniture/wardrobe-configuration.ts"),
  "@/features/furniture/wardrobe-calculation": { WardrobeCalculation: function Calculation(props) {
    return React.createElement("p", null, `Configuration received: ${props.configuration.width_mm}`);
  } },
  "@/config/domains": loadTypeScriptModule("src/config/domains.ts"),
});

test("a refreshed result without temporary state links back to upload", () => {
  image = null;
  confirmed = null;
  const markup = renderToStaticMarkup(React.createElement(WardrobeResult));
  assert.match(markup, /Adaugă din nou schița/);
  assert.match(markup, /href="\/domenii\/mobilier\/proiect-nou"/);
});

test("an uploaded image alone cannot trigger a calculation", () => {
  image = { url: "blob:test" };
  confirmed = null;
  const markup = renderToStaticMarkup(React.createElement(WardrobeResult));
  assert.match(markup, /Confirmă mai întâi configurația/);
  assert.ok(!markup.includes("Configuration received"));
});

test("calculation receives the confirmed snapshot without requiring the uploaded image", () => {
  image = null;
  confirmed = { width_mm: 801, height_mm: 2000, depth_mm: 600, doors_count: 2, shelves_count: 3, furniture_type: "wardrobe" };
  const markup = renderToStaticMarkup(React.createElement(WardrobeResult));
  assert.match(markup, /Configuration received: 801/);
  assert.ok(!markup.includes("Adaugă din nou"));
});

test("a changed confirmed configuration remounts the request to discard old results", () => {
  const previous = WardrobeResult().props.children[3].key;
  confirmed = { ...confirmed, width_mm: 1200 };
  const updated = WardrobeResult().props.children[3].key;
  assert.notEqual(updated, previous);
});
