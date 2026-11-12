"""Exact net edge lengths derived exclusively from existing panel dimensions."""

from decimal import Decimal

from forma.domains.furniture.edge_banding_rules import EDGE_ASSUMPTIONS, EDGE_CONVENTION, EDGE_NAMES
from forma.domains.furniture.schemas import EdgeBandingResult, EdgeBandingTotals, EdgeDetail, Panel, PanelEdgeDetails


def calculate_edge_banding(panels: tuple[Panel, ...]) -> EdgeBandingResult:
    totals = {"abs_0_4": Decimal(0), "abs_2": Decimal(0)}
    panel_details = []
    for panel in panels:
        if panel.material == "HDF":
            if panel.edges is not None:
                raise ValueError("HDF panels must have no edge banding metadata.")
            continue
        if panel.edges is None:
            raise ValueError(f"Missing edge banding metadata for PAL panel: {panel.id}")

        lengths = {
            "length_start": panel.width_mm,
            "length_end": panel.width_mm,
            "width_start": panel.length_mm,
            "width_end": panel.length_mm,
        }
        edges = []
        for edge, banding_type in panel.edges.model_dump().items():
            net_per_piece = Decimal(0)
            if banding_type != "none":
                net_per_piece = lengths[edge] / Decimal("1000")
                totals[banding_type] += net_per_piece * panel.quantity
            edges.append(EdgeDetail(
                edge=edge,
                name=EDGE_NAMES[edge],
                banding_type=banding_type,
                length_mm=lengths[edge],
                net_length_per_piece_m=net_per_piece,
                total_net_length_m=net_per_piece * panel.quantity,
            ))
        net_per_piece = sum((edge.net_length_per_piece_m for edge in edges), Decimal(0))
        panel_details.append(PanelEdgeDetails(
            panel_id=panel.id, name=panel.name, quantity=panel.quantity, edges=tuple(edges),
            net_length_per_piece_m=net_per_piece,
            total_net_length_m=net_per_piece * panel.quantity,
        ))

    return EdgeBandingResult(
        panel_edges=tuple(panel_details),
        totals_by_type=EdgeBandingTotals(abs_0_4_total_m=totals["abs_0_4"], abs_2_total_m=totals["abs_2"]),
        total_net_length_m=sum(totals.values(), Decimal(0)),
        procurement_allowance_m=Decimal(0),
        edge_convention=EDGE_CONVENTION,
        assumptions=EDGE_ASSUMPTIONS,
    )
