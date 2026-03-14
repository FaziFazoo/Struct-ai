"""
Main FastAPI application for S.T.R.U.C.T
Structural Testing, Reasoning & Unified Computational Tool
"""
import logging
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import uuid
from datetime import datetime

from app.solvers.beam_solver import BeamSolver
from app.solvers.thermal_solver import ThermalSolver
from app.solvers.material_db import get_material_properties, MATERIALS, Material, fetch_and_store_material
from app.solvers.unit_converter import to_si
from app.solvers.verification import VerificationEngine
from app.solvers.visualization import VisualizationEngine
from app.agents.gemini_agent import GeminiAgent
from app.agents.vision_module import VisionModule
from app.agents.dynamic_solver import DynamicSolverAgent
from app.agents.normalizer import normalize_params, validate_params, to_engine_params

# ── Logging setup ─────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="[S.T.R.U.C.T] %(levelname)s: %(message)s")
log = logging.getLogger("struct")

app = FastAPI(title="S.T.R.U.C.T API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize engines
viz_engine = VisualizationEngine(output_dir="static/plots")

# Vertex AI Configuration
project_id = os.getenv("GOOGLE_CLOUD_PROJECT", "")
location = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")

if project_id:
    log.info(f"GCP Project ID loaded: {project_id} (Location: {location})")
else:
    log.warning("No GOOGLE_CLOUD_PROJECT set — Vertex AI calls will fail unless ADC provides a default project.")

jarvis = GeminiAgent(project_id=project_id, location=location)
vision = VisionModule(project_id=project_id, location=location)
dynamic_solver_agent = DynamicSolverAgent(api_key=os.getenv("GOOGLE_API_KEY", "")) # Keep dynamic solver api_key compat for now unless specified

# Session-based simulation history (in-memory)
simulation_sessions: Dict[str, List[Dict[str, Any]]] = {}


@app.get("/health")
async def health_check():
    """Health check endpoint for deployment readiness probes."""
    return {
        "status": "ok",
        "service": "S.T.R.U.C.T API",
        "vertex_configured": bool(project_id),
    }


# ── Pydantic models ───────────────────────────────────────────────────────────
class BeamAnalysisRequest(BaseModel):
    length: float
    load_magnitude: float
    load_position: float
    support_type: str
    material: str
    units: Optional[dict] = None
    session_id: Optional[str] = None
    beam_width: Optional[float] = None   # metres
    beam_height: Optional[float] = None  # metres

class DiagramAnalysisRequest(BaseModel):
    image: str
    prompt: Optional[str] = "Extract beam length, load, boundary conditions, and dimensions from this engineering diagram"


# ── Core analysis helper ──────────────────────────────────────────────────────
def _run_analysis(length: float, load_magnitude: float, load_position: float,
                  support_type: str, material_name: str, session_id: Optional[str] = None,
                  beam_width: Optional[float] = None, beam_height: Optional[float] = None):
    """
    Runs the full FEM pipeline and returns a standardized result dict.
    All values must already be in SI units (metres, Newtons) before calling this.
    """
    log.info(f"Simulation START — L={length}m, P={load_magnitude}N, a={load_position}m, "
             f"type={support_type}, mat={material_name}, bw={beam_width}, bh={beam_height}")

    # Defaults for cross-section
    bw = beam_width if (beam_width is not None and beam_width > 0) else 0.1
    bh = beam_height if (beam_height is not None and beam_height > 0) else 0.1

    if not material_name or material_name.strip() == "":
        material_name = "Carbon Steel"
        log.info("No material specified — defaulting to Carbon Steel")

    material_props = get_material_properties(material_name)
    log.info(f"Material resolved: {material_props.name}, E={material_props.youngs_modulus/1e9:.1f} GPa")

    solver = BeamSolver(length, load_magnitude, load_position, support_type, material_props,
                        beam_width=bw, beam_height=bh)
    results = solver.solve()
    results["beam_length"] = length
    results["material"] = material_props.name

    log.info(f"Solver done — max_stress={results['max_stress']/1e6:.2f} MPa, "
             f"max_deflection={results['max_deflection']*1000:.3f} mm")

    ver_engine = VerificationEngine(material_props)
    verification = ver_engine.verify(results)
    log.info(f"Verification — status={verification['status']}, FoS={verification['factor_of_safety']:.2f}")

    log.info("Generating plot...")
    plot_base64 = viz_engine.generate_plots(results)
    log.info(f"Plot generated — base64 length={len(plot_base64)}")

    sim_id = str(uuid.uuid4())

    response = {
        # Top-level flat fields for easy frontend binding (Step 2 of the spec)
        "simulation_id": sim_id,
        "timestamp": datetime.utcnow().isoformat(),
        "status": verification["status"],
        "max_stress": float(results["max_stress"]),           # Pa
        "max_stress_mpa": float(results["max_stress"] / 1e6), # MPa (convenience)
        "deflection": float(abs(results["max_deflection"])),  # m
        "deflection_mm": float(abs(results["max_deflection"]) * 1000), # mm (convenience)
        "safety_factor": float(verification["factor_of_safety"]),
        "plot_image": plot_base64,
        # Nested fields (keep for backward compat with dashboard components)
        "results": results,
        "verification": verification,
        "material": {
            "name": material_props.name,
            "youngs_modulus": material_props.youngs_modulus,
            "density": material_props.density,
            "yield_strength": material_props.yield_strength,
            "thermal_expansion": material_props.thermal_expansion,
        },
    }

    # Session history (exclude plot_image to save memory)
    if session_id:
        if session_id not in simulation_sessions:
            simulation_sessions[session_id] = []
        rec = {k: v for k, v in response.items() if k != "plot_image"}
        simulation_sessions[session_id].append(rec)

    log.info(f"Simulation COMPLETE — id={sim_id[:8]}")
    return response


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.post("/beam_analysis")
async def analyze_beam(request: BeamAnalysisRequest):
    log.info(f"/beam_analysis called: {request.dict()}")

    length = request.length
    load_magnitude = request.load_magnitude
    load_position = request.load_position

    # Unit conversion (only if units are explicitly provided by caller)
    if request.units:
        length = to_si(length, request.units.get("length", "m"))
        load_magnitude = to_si(load_magnitude, request.units.get("force", "N"))
        load_position = to_si(load_position, request.units.get("length", "m"))
        log.info(f"After unit conversion: L={length}, P={load_magnitude}, a={load_position}")

    bw = request.beam_width
    bh = request.beam_height
    # Heuristic: if cross-section values > 1.0 and units say 'mm', convert
    if bw is not None and bw > 1.0:
        bw = bw / 1000.0
        log.info(f"Converted beam_width {request.beam_width}mm → {bw}m")
    if bh is not None and bh > 1.0:
        bh = bh / 1000.0
        log.info(f"Converted beam_height {request.beam_height}mm → {bh}m")

    try:
        return _run_analysis(length, load_magnitude, load_position,
                             request.support_type, request.material, request.session_id,
                             beam_width=bw, beam_height=bh)
    except Exception as e:
        log.error(f"/beam_analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/material_lookup")
async def lookup_material(name: str):
    material = get_material_properties(name)
    return {
        "name": material.name,
        "youngs_modulus": material.youngs_modulus,
        "density": material.density,
        "yield_strength": material.yield_strength,
        "thermal_expansion": material.thermal_expansion,
    }


@app.post("/thermal_stress")
async def analyze_thermal_stress(material: str, delta_t: float, length: float):
    material_props = get_material_properties(material)
    solver = ThermalSolver(material_props, delta_t, length)
    return solver.solve()


@app.post("/chat")
async def chat_with_struct(query: str):
    """
    Conversational endpoint — uses a SINGLE Gemini call that returns
    both the reply text and any structural parameters detected.
    The frontend can use the parameters field to trigger simulation directly.
    All parameters pass through the normalization + validation layer.
    """
    log.info(f"/chat: {query[:80]}")
    try:
        reply, raw_params = await jarvis.process_combined(query)
        normalized = normalize_params(raw_params, source="text")
        if normalized:
            valid, result = validate_params(normalized)
            if valid:
                return {"response": reply, "parameters": result, "missing_fields": None}
            else:
                return {"response": reply + " " + result, "parameters": None, "missing_fields": result}
        return {"response": reply, "parameters": None, "missing_fields": None}
    except Exception as e:
        log.error(f"/chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/parse_parameters")
async def parse_parameters(query: str):
    """Parameter extraction endpoint — uses normalizer for consistency."""
    log.info(f"/parse_parameters: {query[:80]}")
    try:
        _, raw_params = await jarvis.process_combined(query)
        normalized = normalize_params(raw_params, source="text")
        if normalized:
            valid, result = validate_params(normalized)
            if valid:
                log.info(f"Extracted + validated parameters: {result}")
                return {"parameters": result}
            else:
                log.warning(f"Validation failed: {result}")
                raise HTTPException(status_code=400, detail=result)
        else:
            log.warning("No structural parameters extracted from query")
            raise HTTPException(status_code=400, detail="Could not extract structural parameters from text")
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"/parse_parameters error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/diagram_analysis")
async def analyze_diagram(request: DiagramAnalysisRequest):
    log.info("/diagram_analysis called")
    try:
        vision_res = await vision.extract_parameters(request.image, request.prompt)
        if not vision_res:
             raise HTTPException(status_code=400, detail="Vision analysis failed to return data.")
             
        # New conversational copilot flow: Check if Gemini needs clarification
        if vision_res.get("status") == "clarify":
            log.info(f"Vision clarify requested: {vision_res.get('message')}")
            return {"status": "clarify", "message": vision_res.get("message")}
            
        raw_params = vision_res.get("parameters")
        normalized = normalize_params(raw_params, source="image")
        if normalized:
            valid, result = validate_params(normalized)
            if not valid:
                log.warning(f"/diagram_analysis validation failed: {result}")
                return {"status": "clarify", "message": f"I extracted some parameters, but {result}"}
            engine_params = to_engine_params(result)
            log.info(f"/diagram_analysis running simulation with: {engine_params}")
            res = _run_analysis(**engine_params)
            res["parameters"] = result
            res["status"] = "success"
            return res
        else:
            return {"status": "clarify", "message": "I couldn't identify any clear structural parameters in this diagram. Could you describe the beam textually?"}
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"/diagram_analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/simulation_history/{session_id}")
async def get_simulation_history(session_id: str):
    history = simulation_sessions.get(session_id, [])
    return {"session_id": session_id, "count": len(history), "history": history}


@app.post("/dynamic_solver")
async def run_dynamic_solver(analysis_type: str, parameters: dict):
    result = await dynamic_solver_agent.solve(analysis_type, parameters)
    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
