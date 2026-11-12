import assert from "node:assert/strict";
import test from "node:test";
import {
  configurationToDraft,
  isMockInterpretation,
  validateWardrobeDraft,
  wardrobeFields,
  wardrobeRules,
} from "../src/features/furniture/wardrobe-configuration.ts";

const example = {
  width_mm: 800, height_mm: 2000, depth_mm: 600,
  doors_count: 2, shelves_count: 3, furniture_type: "wardrobe",
  is_mock: true, requires_confirmation: true, notice: "Date demonstrative",
};

test("editing produces a configuration independent of the original interpretation", () => {
  const original = Object.freeze({ ...example });
  const draft = configurationToDraft(original);
  draft.width_mm = "1200";
  const { configuration } = validateWardrobeDraft(draft);
  assert.equal(configuration.width_mm, 1200);
  assert.equal(original.width_mm, 800);
  assert.equal(configuration.furniture_type, "wardrobe");
});

for (const field of wardrobeFields) {
  test(`${field} accepts boundaries and rejects out-of-range or non-integer input`, () => {
    const rule = wardrobeRules[field];
    for (const value of [rule.min, rule.max]) {
      const draft = { ...configurationToDraft(example), [field]: String(value) };
      assert.ok(validateWardrobeDraft(draft).configuration);
    }
    for (const value of ["", " ", "1.5", "1e3", "NaN", "Infinity", "-1", String(rule.min - 1), String(rule.max + 1)]) {
      const { errors, configuration } = validateWardrobeDraft({ ...configurationToDraft(example), [field]: value });
      assert.equal(configuration, null);
      assert.ok(errors[field]);
    }
  });
}

test("API responses require mock markers, supported furniture and valid numeric configuration", () => {
  assert.equal(isMockInterpretation(example), true);
  for (const invalid of [null, {}, { ...example, is_mock: false }, { ...example, requires_confirmation: false }, { ...example, furniture_type: "kitchen" }, { ...example, width_mm: "800" }, { ...example, width_mm: 0 }, { ...example, shelves_count: 11 }]) {
    assert.equal(isMockInterpretation(invalid), false);
  }
});
