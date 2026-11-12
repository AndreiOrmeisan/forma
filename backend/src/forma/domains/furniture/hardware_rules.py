"""Provisional, manufacturer-independent FORMA v1 hardware rules."""

from decimal import Decimal

HDF_MAX_SPACING_MM = Decimal("150")
SUPPORTS_PER_SHELF = 4
CONNECTORS_PER_HORIZONTAL_PANEL = 4

HARDWARE_ASSUMPTIONS = (
    "Estimare preliminară de feronerie pentru profilul FORMA v1.",
    "Balamale pe ușă, după înălțimea efectivă a panoului: până la 900 mm inclusiv — 2; până la 1600 mm inclusiv — 3; până la 2200 mm inclusiv — 4; peste 2200 mm — 5.",
    "Alegerea finală a balamalelor depinde de greutatea, lățimea și materialul ușii, precum și de specificațiile producătorului.",
    "Toate polițele configurate sunt considerate reglabile și folosesc câte 4 suporturi.",
    "Fiecare ușă folosește un mâner. Corpul folosește 4 conectori la capac și 4 la bază.",
    "Fixările HDF sunt estimate pe fiecare latură, cu pas țintă maxim de 150 mm și colțuri numărate o singură dată.",
    "Poziționarea și alegerea fixărilor HDF se verifică la montaj.",
)


def hinges_per_door(door_height_mm: Decimal) -> int:
    if not door_height_mm.is_finite() or door_height_mm <= 0:
        raise ValueError("Door height must be positive and finite.")
    if door_height_mm <= 900:
        return 2
    if door_height_mm <= 1600:
        return 3
    if door_height_mm <= 2200:
        return 4
    return 5


def perimeter_fastener_count(length_mm: Decimal, width_mm: Decimal) -> int:
    """2*(ceil(L/150)+ceil(W/150)), with each corner counted once."""
    intervals = []
    for dimension in (length_mm, width_mm):
        if not dimension.is_finite() or dimension <= 0:
            raise ValueError("HDF dimensions must be positive and finite.")
        count = int(dimension // HDF_MAX_SPACING_MM)
        if dimension % HDF_MAX_SPACING_MM:
            count += 1
        intervals.append(count)
    return 2 * sum(intervals)
