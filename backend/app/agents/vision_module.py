"""
Vision module for S.T.R.U.C.T.
Uses Gemini Vision via Vertex AI to extract beam parameters from structural diagrams.
Falls back to a clarify response if Vertex AI is unavailable or parsing fails.
"""
import json
import base64
import logging

log = logging.getLogger("struct")

try:
    import vertexai
    from vertexai.generative_models import GenerativeModel, Part
    VERTEXAI_AVAILABLE = True
except ImportError:
    log.error("[VisionModule] google-cloud-aiplatform not installed. Vision calls will be unavailable.")
    VERTEXAI_AVAILABLE = False

VISION_PROMPT = (
    "You are S.T.R.U.C.T, an expert structural engineering AI copilot. "
    "Analyze this engineering diagram (free body diagram, beam sketch, or structural drawing) "
    "with aerospace-grade precision. "
    "Extract all visible beam parameters, paying close attention to labels, units, and support symbols. "
    "Return ONLY a raw JSON object (no markdown, no backticks, no extra text). "
    "\n\n"
    "Required JSON structure:\n"
    '{"status": "success", "message": "Parameters extracted.", '
    '"parameters": {"beam_type": "cantilever" or "simply_supported", '
    '"length": <float in metres>, "load": <float in Newtons>, '
    '"load_position": <float in metres from left support>, '
    '"width": <float in metres>, "height": <float in metres>, '
    '"material": "<string>"}}\n\n'
    "If any critical value (length or load) is ambiguous, use your engineering judgment "
    "to provide a best-estimate value and set 'status': 'clarify' with a message explaining the assumption."
)

# MIME type detection from base64 data-URL header
_MIME_MAP = {
    "data:image/jpeg": "image/jpeg",
    "data:image/jpg":  "image/jpeg",
    "data:image/png":  "image/png",
    "data:image/gif":  "image/gif",
    "data:image/webp": "image/webp",
}


def _detect_mime(b64_string: str) -> str:
    for prefix, mime in _MIME_MAP.items():
        if b64_string.startswith(prefix):
            return mime
    return "image/jpeg"  # safe default


class VisionModule:
    def __init__(self, project_id: str, location: str = "us-central1"):
        self.model = None

        if not VERTEXAI_AVAILABLE:
            log.warning("[VisionModule] Vertex AI library unavailable — vision calls will fail")
            return

        if not project_id:
            log.warning("[VisionModule] No GCP project_id — vision calls will fail")
            return

        try:
            log.info(f"[VisionModule] Initialising Vertex AI — project={project_id}, location={location}")
            vertexai.init(project=project_id, location=location)
            self.model = GenerativeModel("gemini-1.5-flash")
            log.info(f"[VisionModule] Vertex AI initialised OK — project={project_id}")
        except Exception as e:
            log.error(f"[VisionModule] Vertex AI init failed: {type(e).__name__}: {e}", exc_info=True)
            self.model = None

    async def extract_parameters(self, base64_image: str, prompt: str = None):
        """
        Extracts structural engineering parameters from a beam diagram image.
        Returns a structured dict or a clarify response on failure. Never returns None.
        """
        if not self.model:
            log.error("[VisionModule] No model available — returning clarify response")
            return {
                "status": "clarify",
                "message": (
                    "Vision AI is not available in this deployment configuration. "
                    "Please describe your beam configuration using text instead."
                ),
                "parameters": None,
            }

        effective_prompt = prompt if prompt else VISION_PROMPT
        log.info(f"[VisionModule] Processing image (base64 length={len(base64_image)})")

        try:
            # Detect MIME type from data-URL header
            mime_type = _detect_mime(base64_image)
            log.info(f"[VisionModule] Detected MIME type: {mime_type}")

            # Strip data-URL prefix if present
            if "base64," in base64_image:
                base64_image = base64_image.split("base64,")[1]

            img_bytes = base64.b64decode(base64_image)
            image_part = Part.from_data(data=img_bytes, mime_type=mime_type)
            log.info("[VisionModule] Image decoded and packaged into Vertex Part")

            response = await self.model.generate_content_async([image_part, effective_prompt])
            text = response.text.strip()
            log.info(f"[VisionModule] Gemini raw response: {text[:300]}")

            # Strip accidental markdown fences
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()

            result = json.loads(text)
            log.info(f"[VisionModule] Parsed result: status={result.get('status')}")
            return result

        except json.JSONDecodeError as e:
            log.error(f"[VisionModule] JSON parse error: {e}")
            return {
                "status": "clarify",
                "message": (
                    "I analyzed the diagram but couldn't parse the structural parameters clearly. "
                    "Could you describe your beam configuration using text?"
                ),
                "parameters": None,
            }
        except Exception as e:
            log.error(f"[VisionModule] Error processing image: {type(e).__name__}: {e}", exc_info=True)
            return {
                "status": "clarify",
                "message": (
                    f"Vision analysis encountered an error ({type(e).__name__}). "
                    "Please describe your beam configuration using text instead."
                ),
                "parameters": None,
            }
