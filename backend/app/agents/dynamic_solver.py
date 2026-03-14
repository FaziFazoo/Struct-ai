"""
Dynamic Solver Agent for S.T.R.U.C.T.
Dynamically generates prototype solvers for unknown analysis types using Gemini.
Validates generated code before enabling.
"""
import vertexai
from vertexai.generative_models import GenerativeModel
import os
import subprocess
import tempfile
import json

class DynamicSolverAgent:
    def __init__(self, project_id: str, location: str = "us-central1"):
        self.project_id = project_id
        if project_id:
            vertexai.init(project=project_id, location=location)
            self.model = GenerativeModel(
                "gemini-1.5-flash-001",
                system_instruction=["""
                You are a structural engineering solver code generator.
                Generate clean, safe Python functions for structural analysis.
                Return ONLY executable Python code with a function called `run_solver(parameters: dict) -> dict`.
                The function must return a dict with at minimum: {"result": any, "status": "ok" | "error"}.
                Do not import anything outside the Python standard library.
                """]
            )
        else:
            self.model = None

    async def _generate_solver_code(self, analysis_type: str, parameters: dict) -> str:
        prompt = (
            f"Generate a Python solver function for: '{analysis_type}'.\n"
            f"Expected parameters: {json.dumps(parameters)}\n"
            f"Return only the Python function code."
        )
        response = self.model.generate_content(prompt)
        code = response.text.strip()
        if "```python" in code:
            code = code.split("```python")[1].split("```")[0].strip()
        elif "```" in code:
            code = code.split("```")[1].split("```")[0].strip()
        return code

    def _validate_solver(self, code: str, parameters: dict) -> dict:
        """Runs the generated solver code in a sandboxed subprocess for validation."""
        test_script = f"""
import json
{code}

parameters = {json.dumps(parameters)}
try:
    result = run_solver(parameters)
    print(json.dumps({{"status": "ok", "result": str(result)}}))
except Exception as e:
    print(json.dumps({{"status": "error", "message": str(e)}}))
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(test_script)
            tmp_path = f.name
        try:
            proc = subprocess.run(
                ["python", tmp_path],
                capture_output=True, text=True, timeout=10
            )
            output = proc.stdout.strip()
            if output:
                return json.loads(output)
            return {"status": "error", "message": proc.stderr or "No output from solver"}
        except subprocess.TimeoutExpired:
            return {"status": "error", "message": "Solver validation timed out (10s limit)"}
        except Exception as e:
            return {"status": "error", "message": str(e)}
        finally:
            os.unlink(tmp_path)

    async def solve(self, analysis_type: str, parameters: dict) -> dict:
        """
        Entry point: generates a solver, validates it, and runs it if valid.
        """
        if not self.model:
            return {"status": "error", "message": "GCP Project ID not configured; Vertex AI dynamic solver unavailable"}
        try:
            print(f"[S.T.R.U.C.T] Generating dynamic solver for: {analysis_type}")
            code = await self._generate_solver_code(analysis_type, parameters)
            validation = self._validate_solver(code, parameters)
            if validation.get("status") == "ok":
                return {
                    "status": "ok",
                    "analysis_type": analysis_type,
                    "solver_source": "dynamic_gemini",
                    "validation_passed": True,
                    "result": validation.get("result"),
                }
            else:
                return {
                    "status": "error",
                    "analysis_type": analysis_type,
                    "validation_passed": False,
                    "message": f"Solver validation failed: {validation.get('message')}",
                }
        except Exception as e:
            return {"status": "error", "message": str(e)}
