import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTypeScriptModule } from "./helpers/load-typescript.mjs";

const source = "src/features/furniture/";
const { createWardrobeLayout, previewViewport } = loadTypeScriptModule(source + "wardrobe-preview-geometry.ts");
const { WardrobePreview2D } = loadTypeScriptModule(source + "wardrobe-preview-2d.tsx");
const example = { widthMm: 800, heightMm: 2000, depthMm: 600, doorsCount: 2, shelvesCount: 3, viewMode: "interior" };
const render = props => renderToStaticMarkup(React.createElement(WardrobePreview2D, props));

function assertInside(rectangle, boundary) {
  assert.ok(rectangle.x >= boundary.x - 1e-9);
  assert.ok(rectangle.y >= boundary.y - 1e-9);
  assert.ok(rectangle.width > 0);
  assert.ok(rectangle.height > 0);
  assert.ok(rectangle.x + rectangle.width <= boundary.x + boundary.width + 1e-9);
  assert.ok(rectangle.y + rectangle.height <= boundary.y + boundary.height + 1e-9);
}

test("narrow and wide elevations retain proportions and fit with annotation margins", () => {
  for (const widthMm of [300, 800, 2400]) {
    for (const heightMm of [400, 2000, 3000]) {
      const layout = createWardrobeLayout({ ...example, widthMm, heightMm });
      assert.ok(Math.abs(layout.outline.width / layout.outline.height - widthMm / heightMm) < 1e-9);
      assert.equal(layout.panels.length, 4);
      assert.ok(layout.heightDimensionX - 25 > 0);
      assert.ok(layout.widthDimensionY + 24 < previewViewport.height);
      assert.ok(layout.outline.x + layout.outline.width + 4 < previewViewport.width);
      for (const panel of layout.panels) assertInside(panel, layout.outline);
      // SVG meet scaling fits mobile content areas and a desktop column.
      for (const containerWidth of [278, 308, 348, 460]) {
        const scale = Math.min(containerWidth / previewViewport.width, 320 / previewViewport.height);
        assert.ok(previewViewport.width * scale <= containerWidth + 1e-9);
        assert.ok(previewViewport.height * scale <= 320 + 1e-9);
      }
    }
  }
});

test("interior shelves are evenly distributed, including zero and maximum shelves", () => {
  for (const shelvesCount of [0, 1, 3, 10]) {
    const layout = createWardrobeLayout({ ...example, shelvesCount });
    assert.equal(layout.shelves.length, shelvesCount);
    assert.equal(layout.doors.length, 0);
    for (const shelf of layout.shelves) assertInside(shelf, layout.outline);
    if (shelvesCount > 1) {
      const gap = layout.shelves[1].y - layout.shelves[0].y;
      for (let index = 1; index < shelvesCount; index++) {
        assert.ok(Math.abs(layout.shelves[index].y - layout.shelves[index - 1].y - gap) < 1e-9);
      }
    }
    if (shelvesCount > 0) {
      const first = layout.shelves[0];
      const last = layout.shelves.at(-1);
      const topPanel = layout.panels[2];
      const bottomPanel = layout.panels[3];
      const topGap = first.y - topPanel.y - topPanel.height;
      const bottomGap = bottomPanel.y - last.y - last.height;
      assert.ok(Math.abs(topGap - bottomGap) < 1e-9);
    }
    const markup = render({ ...example, shelvesCount });
    assert.equal((markup.match(/data-part="shelf"/g) || []).length, shelvesCount);
  }
});

test("one and two doors render with one handle each and hide interior shelves", () => {
  for (const doorsCount of [1, 2]) {
    const props = { ...example, doorsCount, viewMode: "doors" };
    const layout = createWardrobeLayout(props);
    assert.equal(layout.doors.length, doorsCount);
    assert.equal(layout.shelves.length, 0);
    for (const door of layout.doors) {
      assertInside(door, layout.outline);
      assert.ok(door.handleX > door.x && door.handleX < door.x + door.width);
      assert.ok(door.handleY >= door.y);
      assert.ok(door.handleY + door.handleLength <= door.y + door.height);
    }
    const markup = render(props);
    assert.equal((markup.match(/data-part="door"/g) || []).length, doorsCount);
    assert.equal((markup.match(/data-part="handle"/g) || []).length, doorsCount);
    assert.equal((markup.match(/data-part="shelf"/g) || []).length, 0);
  }
});

test("dimension changes update geometry and labels while depth stays numeric", () => {
  const original = createWardrobeLayout(example);
  const wider = createWardrobeLayout({ ...example, widthMm: 1200 });
  assert.equal(wider.outline.width, original.outline.width * 1.5);
  assert.match(render({ ...example, widthMm: 1200, heightMm: 2500 }), /1200 mm/);
  assert.match(render({ ...example, widthMm: 1200, heightMm: 2500 }), /2500 mm/);
  assert.equal(JSON.stringify(createWardrobeLayout({ ...example, depthMm: 750 })), JSON.stringify(original));
  assert.match(render({ ...example, depthMm: 750 }), /750 mm/);
});

test("invalid temporary values produce a recovery message and no invalid SVG", () => {
  for (const invalid of [
    { widthMm: 0 }, { widthMm: Number.NaN }, { heightMm: Infinity },
    { heightMm: -1 }, { depthMm: 1001 }, { shelvesCount: 11 },
    { shelvesCount: 1.5 }, { doorsCount: 0 }, { doorsCount: 3 }, { viewMode: "unknown" },
  ]) {
    assert.equal(createWardrobeLayout({ ...example, ...invalid }), null);
    const markup = render({ ...example, ...invalid });
    assert.match(markup, /role="status"/);
    assert.ok(!markup.includes("<svg"));
    assert.ok(!markup.includes("NaN") && !markup.includes("Infinity"));
  }
});

test("view selection stays stable across draft edits and temporary invalid input", () => {
  let selectedMode;
  const draft = { width_mm: "800", height_mm: "2000", depth_mm: "600", doors_count: "2", shelves_count: "3" };
  const overrides = {
    react: { ...React, useState(initial) {
      selectedMode ??= initial;
      return [selectedMode, value => { selectedMode = value; }];
    } },
    "./wardrobe-project-context": { useWardrobeProject: () => ({ draft }) },
  };
  const { WardrobeConfiguratorPreview } = loadTypeScriptModule(source + "wardrobe-configurator-preview.tsx", overrides);
  let tree = WardrobeConfiguratorPreview();
  const switcherElement = tree.props.children[0].props.children[1];
  const switcher = switcherElement.type(switcherElement.props);
  const radioLabels = switcher.props.children[1];
  assert.equal(radioLabels[0].props.children[0].props.checked, true);
  radioLabels[1].props.children[0].props.onChange();
  draft.width_mm = "1200";
  tree = WardrobeConfiguratorPreview();
  assert.equal(tree.props.children[1].props.viewMode, "doors");
  assert.equal(tree.props.children[1].props.widthMm, 1200);
  assert.equal(draft.height_mm, "2000");
  draft.width_mm = "1e3";
  tree = WardrobeConfiguratorPreview();
  assert.equal(tree.props.children[1].props.viewMode, "doors");
  assert.ok(Number.isNaN(tree.props.children[1].props.widthMm));
  assert.equal(draft.width_mm, "1e3");
  assert.match(render(tree.props.children[1].props), /role="status"/);
  draft.width_mm = "1000";
  tree = WardrobeConfiguratorPreview();
  assert.equal(tree.props.children[1].props.widthMm, 1000);
  assert.equal(tree.props.children[1].props.viewMode, "doors");
});

test("multiple drawings expose unique accessible title and description references", () => {
  const markup = renderToStaticMarkup(React.createElement("div", null,
    React.createElement(WardrobePreview2D, example),
    React.createElement(WardrobePreview2D, { ...example, viewMode: "doors" }),
  ));
  const identifiers = [...markup.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(identifiers.length, 4);
  assert.equal(new Set(identifiers).size, 4);
  assert.equal((markup.match(/role="img"/g) || []).length, 2);
});

test("SVG titles render without React warnings", context => {
  const warnings = [];
  context.mock.method(console, "error", (...args) => warnings.push(args));
  render(example);
  render({ ...example, viewMode: "doors" });
  assert.equal(warnings.length, 0);
});
