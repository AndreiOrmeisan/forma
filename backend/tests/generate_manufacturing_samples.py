"""Regenerate synthetic cross-language contract/sample data, never user projects."""

import json

from test_manufacturing import ROOT, PROFILE, calculate, snapshot


if __name__ == "__main__":
    complete = calculate()
    target = ROOT / "frontend/tests/fixtures/manufacturing-result.json"
    target.write_text(complete.model_dump_json(indent=2), encoding="utf-8")
    samples = ROOT / "output/pdf"
    samples.mkdir(parents=True, exist_ok=True)
    incomplete_profile = PROFILE | {"cutting_precision_mm": None, "front_projection_mm": None}
    (samples / "manufacturing-synthetic.json").write_text(json.dumps({
        "complete": {"snapshot": snapshot(), "result": complete.model_dump(mode="json")},
        "incomplete": {"snapshot": snapshot(incomplete_profile), "result": calculate(incomplete_profile).model_dump(mode="json")},
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Generated synthetic manufacturing contract and PDF sample inputs.")
