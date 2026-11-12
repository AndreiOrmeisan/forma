"""Provisional FORMA v1 edge assignments in each panel's cutting coordinate frame."""

from forma.domains.furniture.schemas import PanelEdges, PanelGeometry

EDGE_NAMES = {
    "length_start": "Începutul lungimii",
    "length_end": "Sfârșitul lungimii",
    "width_start": "Începutul lățimii",
    "width_end": "Sfârșitul lățimii",
}

EDGE_CONVENTION = (
    "length_start și length_end sunt la capetele axei lungimii și măsoară width_mm. "
    "width_start și width_end sunt la capetele axei lățimii și măsoară length_mm. "
    "La laterale, capac, bază și polițe, width_start desemnează muchia frontală."
)

EDGE_ASSUMPTIONS = (
    "Reguli de cantare provizorii pentru profilul FORMA v1.",
    "Lateralele, capacul, baza și polițele primesc ABS de 2 mm pe muchia frontală.",
    "Ușile primesc ABS de 2 mm pe toate cele patru muchii.",
    "ABS de 0,4 mm este suportat de model, cu zero muchii atribuite în profilul curent.",
    "Cantitățile sunt nete. Adaosul de aprovizionare este zero, iar cotele de debitare rămân cele calculate pentru panouri.",
)


def panel_edge_rules(panel: PanelGeometry) -> PanelEdges | None:
    if panel.material == "HDF":
        return None
    if panel.id == "doors":
        return PanelEdges(length_start="abs_2", length_end="abs_2", width_start="abs_2", width_end="abs_2")
    if panel.id in {"sides", "top", "bottom", "shelves"}:
        return PanelEdges(width_start="abs_2")
    raise ValueError(f"Unsupported PAL panel in FORMA v1 edge rules: {panel.id}")
