"""
Vision module for S.T.R.U.C.T.
Uses Gemini Vision to extract beam parameters from structural diagrams.
"""
import vertexai
from vertexai.generative_models import GenerativeModel, Part
import json
import PIL.Image
import base64
import io
import logging

log = logging.getLogger("struct")

VISION_PROMPT = (
    "You are S.T.R.U.C.T, an expert structural engineering AI copilot. "
    "Analyze this engineering diagram (like a Free Body Diagram) and extract beam parameters. "
    "Return ONLY a raw JSON object (no markdown, no backticks). "
    "If the diagram is completely clear and has lengths/forces, return:\n"
    '{"status": "success", "message": "Extracted parameters.", "parameters": {"beam_type": "cantilever"|"simply_supported", "length": float_in_m, "load": float_in_N, "width": float_in_m, "height": float_in_m, "material": "material_name"}}\n'
    "If critical dimensions or loads are missing/illegible, DO NOT guess wildly. Instead, return a clarification request:\n"
    '{"status": "clarify", "message": "I detected the supports and loads, but could not determine the exact beam length or load magnitude. Could you clarify the missing dimensions?", "parameters": null}'
)


class VisionModule:
    def __init__(self, project_id: str, location: str = "us-central1"):
        if project_id:
            vertexai.init(project=project_id, location=location)
            self.model = GenerativeModel("gemini-1.5-pro")
            log.info(f"VisionModule initialised via Vertex AI in {project_id}/{location}")
        else:
            self.model = None
            log.warning("VisionModule: no GCP project_id — vision calls will fail")

    async def extract_parameters(self, base64_image, prompt=None):
        """
        Extracts structural engineering parameters from a beam diagram image.
        Returns a dict with raw extracted keys, or None on failure.
        """
        if not self.model:
            log.error("[Vision] No model available — cannot process image")
            return None

        # Use structured prompt for reliable JSON output
        effective_prompt = prompt if prompt else VISION_PROMPT
        log.info(f"[Vision] Processing image (base64 length={len(base64_image)})")

        try:
            if "base64," in base64_image:
                base64_image = base64_image.split("base64,")[1]

            img_bytes = base64.b64decode(base64_image)
            image_part = Part.from_data(data=img_bytes, mime_type="image/jpeg")
            log.info(f"[Vision] Image decoded and packaged into Vertex Part")

            response = self.model.generate_content([image_part, effective_prompt])

            text = response.text.strip()
            log.info(f"[Vision] Gemini raw response: {text[:200]}")

            # Strip markdown fences if present
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()

            res = json.loads(text)
            log.info(f"[Vision] Parsed parameters: {res}")
            return res

        except json.JSONDecodeError as e:
            log.error(f"[Vision] JSON parse error: {e}")
            return None
        except Exception as e:
            log.error(f"[Vision] Error processing image: {e}", exc_info=True)
            return None
