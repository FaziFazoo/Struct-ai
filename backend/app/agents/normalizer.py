"""
Input Normalization Layer for S.T.R.U.C.T
Ensures all inputs (text, voice, image) produce identical structured
engineering parameters before calling the simulation engine.
"""
import logging
from typing import Optional, Tuple, Union, Dict

log = logging.getLogger("struct")

# ── Required fields for a valid simulation run ────────────────────────────────
REQUIRED_FIELDS = ["beam_type", "length", "load", "material"]

# ── Key aliases: maps various Gemini / regex output keys → canonical keys ─────
_KEY_MAP = {
    # beam_type aliases
    "support_type": "beam_type",
    "beam_type":    "beam_type",
    "type":         "beam_type",
    # length aliases
    "length":       "length",
    "beam_length":  "length",
    "span":         "length",
    # load aliases
    "load":            "load",
    "load_magnitude":  "load",
    "force":           "load",
    # material aliases
    "material": "material",
    "mat":      "material",
    # width aliases
    "width":      "width",
    "beam_width": "width",
    # height aliases
    "height":      "height",
    "beam_height": "height",
    "depth":       "height",
    # load_position aliases
    "load_position": "load_position",
}

# ── Material name normalization ───────────────────────────────────────────────
_MATERIAL_ALIASES = {
    "steel":      "Carbon Steel",
    "carbon steel": "Carbon Steel",
    "mild steel": "Carbon Steel",
    "aluminum":   "Aluminum 6061",
    "aluminium":  "Aluminum 6061",
    "titanium":   "Titanium",
    "stainless":  "SS304",
    "stainless steel": "SS304",
    "ss304":      "SS304",
}

# ── Defaults ──────────────────────────────────────────────────────────────────
_DEFAULTS = {
    "beam_type": "cantilever",
    "length":    2.0,
    "load":      500.0,
    "material":  "Carbon Steel",
    "width":     0.1,
    "height":    0.1,
}


def _normalize_material(name: str) -> str:
    """Maps common material names to the canonical names in the material DB."""
    if not name:
        return "Carbon Steel"
    lower = name.lower().strip()
    for alias, canonical in _MATERIAL_ALIASES.items():
        if alias in lower:
            return canonical
    return name  # Return as-is if no alias matches; material_db will handle lookup


def normalize_params(raw_params: Optional[dict], source: str = "unknown") -> Optional[dict]:
    """
    Maps varied parameter key names into the canonical normalized format.

    Args:
        raw_params: dict from Gemini, regex, or vision extraction (may be None).
        source: one of 'text', 'voice', 'image' — for logging.

    Returns:
        Normalized dict or None if raw_params is None.
    """
    if raw_params is None:
        log.info(f"[Normalizer] Input received: {source} — no parameters to normalize")
        return None

    log.info(f"[Normalizer] Input received: {source}")
    log.info(f"[Normalizer] Raw parameters: {raw_params}")

    normalized = {}
    for raw_key, value in raw_params.items():
        canonical = _KEY_MAP.get(raw_key)
        if canonical and canonical not in normalized:
            normalized[canonical] = value

    # Apply defaults for missing optional fields
    for key, default in _DEFAULTS.items():
        if key not in normalized:
            normalized[key] = default

    # Normalize material name to match material_db entries
    if "material" in normalized:
        normalized["material"] = _normalize_material(str(normalized["material"]))

    # Derive load_position if missing
    if "load_position" not in normalized:
        beam_len = float(normalized.get("length", 2.0))
        if normalized.get("beam_type") == "cantilever":
            normalized["load_position"] = beam_len
        else:
            normalized["load_position"] = beam_len / 2.0

    # Ensure numeric types
    for num_key in ("length", "load", "width", "height", "load_position"):
        if num_key in normalized:
            try:
                normalized[num_key] = float(normalized[num_key])
            except (ValueError, TypeError):
                pass

    log.info(f"[Normalizer] Normalized parameters: {normalized}")
    return normalized


def validate_params(normalized: Optional[dict]) -> Tuple[bool, Union[dict, str]]:
    """
    Validates that all required fields are present and non-empty.

    Returns:
        (True,  normalized_dict) if valid.
        (False, error_message)   if a required field is missing.
    """
    if normalized is None:
        return False, "No structural parameters detected."

    missing = []
    for field in REQUIRED_FIELDS:
        val = normalized.get(field)
        if val is None or (isinstance(val, str) and val.strip() == ""):
            missing.append(field)

    if missing:
        msg = f"Missing required parameter(s): {', '.join(missing)}. Please provide them."
        log.warning(f"[Normalizer] Validation failed — {msg}")
        return False, msg

    log.info("[Normalizer] Validation passed ✓")
    return True, normalized


def to_engine_params(normalized: dict) -> dict:
    """
    Converts normalized format into the exact kwargs expected by _run_analysis().
    This bridges the canonical schema to the existing solver interface.
    """
    return {
        "length":         normalized["length"],
        "load_magnitude": normalized["load"],
        "load_position":  normalized["load_position"],
        "support_type":   normalized["beam_type"],
        "material_name":  str(normalized["material"]),
        "beam_width":     normalized.get("width"),
        "beam_height":    normalized.get("height"),
    }
