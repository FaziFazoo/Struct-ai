"""
Gemini Agent for S.T.R.U.C.T.
Handles conversation AND structural parameter extraction in a SINGLE Vertex AI call.
Falls back to local regex extraction if Vertex AI is unavailable or fails.
"""
import json
import re
import logging

log = logging.getLogger("struct")

try:
    import vertexai
    from vertexai.generative_models import GenerativeModel
    VERTEXAI_AVAILABLE = True
except ImportError:
    log.error("[GeminiAgent] google-cloud-aiplatform not installed. AI calls will be unavailable.")
    VERTEXAI_AVAILABLE = False

# ── System instruction for the combined reply+extract call ─────────────────────
_SYSTEM_INSTRUCTION = """
You are S.T.R.U.C.T — Structural Testing, Reasoning & Unified Computational Tool.
You are a structural engineering AI copilot assistant.

For every user message, respond with a SINGLE raw JSON object (no markdown, no code fences) with exactly two keys:

If the message is purely conversational (greetings, questions, clarifications):
{
  "reply": "Your plain-text conversational response (max 3 sentences, no code, no markdown)",
  "parameters": null
}

If the user describes a structural analysis query (beam, load, material, support, dimensions):
{
  "reply": "Your brief professional confirmation of what you will analyze",
  "parameters": {
    "length": float_in_metres,
    "load_magnitude": float_in_newtons,
    "load_position": float_in_metres,
    "support_type": "cantilever" or "simply_supported",
    "material": "material name string",
    "beam_width": float_in_metres,
    "beam_height": float_in_metres
  }
}

STRICT RULES:
1. Always output raw JSON only — NEVER any text outside the JSON object.
2. Convert all units to SI (metres, Newtons) before inserting into parameters.
3. If cross-section width/height are in mm, divide by 1000 to get metres.
4. Missing parameters use defaults: length=2.0, load_magnitude=500, load_position=length,
   support_type="cantilever", material="Carbon Steel", beam_width=0.1, beam_height=0.1.
5. "reply" must be plain text only — NO code, NO backticks, NO markdown.
6. Set "parameters" to null for purely conversational messages.
7. After a simulation result is injected with [SYSTEM_INJECT], provide a concise 3-4 sentence
   engineering insight — mention critical stress location, safety status (FoS > 1), and a follow-up suggestion.
"""


class GeminiAgent:
    def __init__(self, project_id: str, location: str = "us-central1"):
        self.model = None
        self.chat = None

        if not VERTEXAI_AVAILABLE:
            log.warning("[GeminiAgent] Vertex AI library unavailable — regex fallback only")
            return

        if not project_id:
            log.warning("[GeminiAgent] No GCP project_id — regex fallback only")
            return

        try:
            log.info(f"[GeminiAgent] Initialising Vertex AI — project={project_id}, location={location}")
            vertexai.init(project=project_id, location=location)
            self.model = GenerativeModel(
                "gemini-1.5-flash",
                system_instruction=[_SYSTEM_INSTRUCTION]
            )
            self.chat = self.model.start_chat()
            log.info(f"[GeminiAgent] Vertex AI initialised OK — project={project_id}")
        except Exception as e:
            log.error(f"[GeminiAgent] Vertex AI init failed: {type(e).__name__}: {e}", exc_info=True)
            self.model = None
            self.chat = None

    # ── Combined Gemini call: returns (reply_text, params_or_None) ────────────
    async def process_combined(self, query: str):
        """
        Makes ONE Gemini call and returns (reply_text, parameters_or_None).
        Always falls back gracefully to local regex on any AI failure.
        """
        if self.chat:
            try:
                response = self.chat.send_message(query)
                text = response.text.strip()

                # Strip accidental markdown fences
                if "```json" in text:
                    text = text.split("```json")[1].split("```")[0].strip()
                elif "```" in text:
                    text = text.split("```")[1].split("```")[0].strip()

                data = json.loads(text)
                reply = data.get("reply", "Analysis complete.")
                params = data.get("parameters", None)
                log.info(f"[GeminiAgent] Vertex AI call OK — params={'extracted' if params else 'none (conversational)'}")
                return reply, params

            except json.JSONDecodeError as e:
                log.error(f"[GeminiAgent] JSON parse error from Gemini response: {e}")
                return self._local_fallback_reply(query), self._regex_extract(query)

            except Exception as e:
                log.error(f"[GeminiAgent] Vertex AI call failed: {type(e).__name__}: {e}", exc_info=True)
                fallback_reply = (
                    "S.T.R.U.C.T local engine active — Vertex AI temporarily unavailable. "
                    "Using local parameter extraction."
                )
                return fallback_reply, self._regex_extract(query)
        else:
            log.info("[GeminiAgent] No AI model configured — using local regex engine")
            return self._local_fallback_reply(query), self._regex_extract(query)

    # ── Legacy compat methods ─────────────────────────────────────────────────
    async def process_query(self, query: str):
        reply, _ = await self.process_combined(query)
        return reply

    async def extract_parameters(self, query: str):
        _, params = await self.process_combined(query)
        return params

    # ── Local fallback reply (no API needed) ──────────────────────────────────
    def _local_fallback_reply(self, query: str) -> str:
        q = query.lower()
        if any(kw in q for kw in ["beam", "cantilever", "supported", "load", "stress", "deflect", "analy"]):
            return (
                "S.T.R.U.C.T local engine active. "
                "I detected a structural query and will extract parameters using the local engine."
            )
        return (
            "S.T.R.U.C.T standing by. "
            "Describe your beam configuration (type, length, load, material) to begin analysis."
        )

    # ── Regex fallback parameter extractor ───────────────────────────────────
    def _regex_extract(self, text: str):
        """
        Local regex-based structural parameter extraction.
        Returns None when no structural intent is detected.
        Works without any API calls.
        """
        text_lower = text.lower()

        structural_keywords = [
            "beam", "cantilever", "simply supported", "simply-supported", "load", "force",
            "stress", "deflection", "analyze", "analyse", "analysis",
            "span", "length", "width", "height", "material",
            "steel", "aluminum", "aluminium", "timber", "concrete", "titanium"
        ]
        if not any(kw in text_lower for kw in structural_keywords):
            log.info("[GeminiAgent] Regex: no structural keywords detected — returning None")
            return None

        log.info("[GeminiAgent] Regex: extracting structural parameters from text")

        # Support type
        support_type = "cantilever"
        if "simply supported" in text_lower or "simply-supported" in text_lower or "pinned" in text_lower:
            support_type = "simply_supported"

        # Length
        length = 2.0
        m = re.search(r'(\d+(?:\.\d+)?)\s*m(?:etre|eter|m)?\b(?!\s*m)', text_lower)
        if m:
            length = float(m.group(1))
        else:
            m = re.search(r'(\d+(?:\.\d+)?)\s*mm\b', text_lower)
            if m:
                length = float(m.group(1)) / 1000.0

        # Load
        load = 500.0
        m = re.search(r'(\d+(?:\.\d+)?)\s*kn\b', text_lower)
        if m:
            load = float(m.group(1)) * 1000.0
        else:
            m = re.search(r'(\d+(?:\.\d+)?)\s*n\b', text_lower)
            if m:
                load = float(m.group(1))

        # Load position
        load_pos = length if support_type == "cantilever" else length / 2.0

        # Beam width
        bw = 0.1
        m = re.search(r'width\s*[=:]?\s*(\d+(?:\.\d+)?)\s*(mm|m)?', text_lower)
        if m:
            val = float(m.group(1))
            unit = m.group(2) or "m"
            bw = val / 1000.0 if (unit == "mm" or val > 1.0) else val

        # Beam height
        bh = 0.1
        m = re.search(r'(?:height|depth|h)\s*[=:]?\s*(\d+(?:\.\d+)?)\s*(mm|m)?', text_lower)
        if m:
            val = float(m.group(1))
            unit = m.group(2) or "m"
            bh = val / 1000.0 if (unit == "mm" or val > 1.0) else val

        # Material
        material = "Carbon Steel"
        for mat_key, mat_name in [
            ("stainless", "SS304"),
            ("steel", "Carbon Steel"),
            ("alumin", "Aluminum 6061"),
            ("titanium", "Titanium"),
            ("timber", "Timber"),
            ("concrete", "Concrete"),
        ]:
            if mat_key in text_lower:
                material = mat_name
                break

        params = {
            "length":        length,
            "load_magnitude": load,
            "load_position":  load_pos,
            "support_type":  support_type,
            "material":      material,
            "beam_width":    bw,
            "beam_height":   bh,
        }
        log.info(f"[GeminiAgent] Regex extracted: {params}")
        return params
