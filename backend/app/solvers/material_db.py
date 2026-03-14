"""
Material database for S.T.R.U.C.T.
Contains properties for common engineering materials.
Auto-fetches unknown materials from Gemini when not found locally.
"""
import vertexai
from vertexai.generative_models import GenerativeModel
import json
import os

class Material:
    def __init__(self, name, youngs_modulus, density, yield_strength, thermal_expansion, poisson_ratio=0.3):
        self.name = name
        self.youngs_modulus = youngs_modulus  # Pa (N/m^2)
        self.density = density                # kg/m^3
        self.yield_strength = yield_strength  # Pa
        self.thermal_expansion = thermal_expansion  # 1/K
        self.poisson_ratio = poisson_ratio

MATERIALS = {
    "SS304": Material("SS304", 193e9, 8000, 215e6, 17.2e-6, 0.29),
    "Aluminum 6061": Material("Aluminum 6061", 68.9e9, 2700, 276e6, 23.6e-6, 0.33),
    "Titanium": Material("Titanium", 114e9, 4500, 880e6, 8.6e-6, 0.34),
    "Carbon Steel": Material("Carbon Steel", 200e9, 7850, 350e6, 12e-6, 0.30),
}

def fetch_and_store_material(material_name: str) -> Material:
    """
    Fetches material properties from Gemini when the material is not in the local database.
    Stores the result so the same lookup is not repeated.
    """
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT", "")
    location = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
    if not project_id:
        print("[S.T.R.U.C.T] No GCP project ID configured, using default Carbon Steel.")
        return MATERIALS["Carbon Steel"]
    try:
        vertexai.init(project=project_id, location=location)
        model = GenerativeModel(
            model_name="gemini-1.5-flash-001",
            system_instruction=(
                "You are a materials science expert. Return ONLY a raw JSON object with exact keys: "
                "{\"youngs_modulus\": float_Pa, \"density\": float_kgm3, \"yield_strength\": float_Pa, "
                "\"thermal_expansion\": float_1perK, \"poisson_ratio\": float}. No extra text."
            )
        )
        response = model.generate_content(f"Provide material properties for: {material_name}")
        text = response.text.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        props = json.loads(text)
        mat = Material(
            name=material_name,
            youngs_modulus=float(props.get("youngs_modulus", 200e9)),
            density=float(props.get("density", 7850)),
            yield_strength=float(props.get("yield_strength", 250e6)),
            thermal_expansion=float(props.get("thermal_expansion", 12e-6)),
            poisson_ratio=float(props.get("poisson_ratio", 0.30)),
        )
        # Cache permanently for this session
        MATERIALS[material_name] = mat
        print(f"[S.T.R.U.C.T] Auto-fetched material: {material_name}")
        return mat
    except Exception as e:
        print(f"[S.T.R.U.C.T] Material fetch failed for '{material_name}': {e}")
        return MATERIALS["Carbon Steel"]


def get_material_properties(material_name: str) -> Material:
    """
    Returns material properties. If not found locally, auto-fetches from Gemini.
    """
    # Direct match
    if material_name in MATERIALS:
        return MATERIALS[material_name]
    # Case-insensitive match
    for name, mat in MATERIALS.items():
        if name.lower() == material_name.lower():
            return mat
    # Auto-fetch from Gemini
    print(f"[S.T.R.U.C.T] Material '{material_name}' not found locally. Fetching...")
    return fetch_and_store_material(material_name)
