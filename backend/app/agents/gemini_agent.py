"""
Gemini Agent for S.T.R.U.C.T.
Handles conversation AND structural parameter extraction in a SINGLE API call
to stay within free-tier rate limits.
Falls back to regex extraction when API quota is exceeded.
"""
import vertexai
from vertexai.generative_models import GenerativeModel
import json
import re
import logging

log = logging.getLogger("struct")


class GeminiAgent:
    def __init__(self, project_id: str, location: str = "us-central1"):
        if project_id:
            vertexai.init(project=project_id, location=location)
            # One model instance for all interactions
            self.model = GenerativeModel(
                "gemini-1.5-flash",
                system_instruction=["""
You are S.T.R.U.C.T — Structural Testing, Reasoning & Unified Computational Tool.
You are a structural engineering AI assistant.

For every user message, respond with a SINGLE raw JSON object (no markdown, no code fences) with exactly these two keys:
{
  "reply": "Your plain-text conversational response here (max 3 sentences, no code, no markdown)",
  "parameters": null
}

OR if the user is describing a structural analysis query (beam, load, material, etc.):
{
  "reply": "Your brief confirmation of what you're analyzing",
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

RULES:
1. Always output raw JSON only — never any text outside the JSON object.
2. Convert all units to SI (metres, Newtons) before putting them in parameters.
3. If cross-section width/height are in mm, divide by 1000 to get metres.
4. If a parameter is missing, use these defaults: length=2.0, load_magnitude=500, load_position=same as length, support_type="cantilever", material="Carbon Steel", beam_width=0.1, beam_height=0.1.
5. "reply" must be plain text only — no code, no backticks, no markdown.
6. Set "parameters" to null if the message is purely conversational.
"""]
            )
            self.chat = self.model.start_chat()
            log.info(f"GeminiAgent initialised via Vertex AI in {project_id}/{location}")
        else:
            self.model = None
            self.chat = None
            log.warning("GeminiAgent: no GCP project_id — will use regex fallback only")

    # ── Single combined Gemini call ────────────────────────────────────────
    async def process_combined(self, query: str):
        """
        Makes ONE Gemini call and returns (reply_text, parameters_or_None).
        Falls back to regex extraction on quota errors.
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
                log.info(f"Gemini combined call OK — params={'yes' if params else 'no'}")
                return reply, params
            except Exception as e:
                err_str = f"Vertex AI Error: {str(e)}"
                log.error(err_str, exc_info=True)
                return err_str, self._regex_extract(query)
        else:
            msg = "S.T.R.U.C.T local engine (Vertex AI not configured)."
            return msg, self._regex_extract(query)

    # ── Legacy compat: kept so old /chat and /parse_parameters still work ──
    async def process_query(self, query: str):
        reply, _ = await self.process_combined(query)
        return reply

    async def extract_parameters(self, query: str):
        _, params = await self.process_combined(query)
        return params

    # ── Regex fallback ─────────────────────────────────────────────────────
    def _regex_extract(self, text: str):
        """
        Local regex-based structural parameter extraction.
        Works without any API calls when quota is exceeded.
        Returns None if no structural keywords are found.
        """
        text_lower = text.lower()

        # Only attempt extraction if this looks like a structural query
        structural_keywords = [
            "beam", "cantilever", "simply supported", "load", "force",
            "stress", "deflection", "analyze", "analyse", "analysis",
            "span", "length", "width", "height", "material", "steel",
            "aluminum", "aluminium", "timber", "concrete"
        ]
        if not any(kw in text_lower for kw in structural_keywords):
            log.info("Regex fallback: no structural keywords — skipping")
            return None

        log.info("Regex fallback: extracting structural parameters")

        # Support type
        support_type = "cantilever"
        if "simply supported" in text_lower or "simply-supported" in text_lower or "pinned" in text_lower:
            support_type = "simply_supported"

        # Length (m or mm)
        length = 2.0
        m = re.search(r'(\d+(?:\.\d+)?)\s*m(?:etre|eter|m)?\b(?!\s*m)', text_lower)
        if m:
            length = float(m.group(1))
        else:
            m = re.search(r'(\d+(?:\.\d+)?)\s*mm\b', text_lower)
            if m:
                length = float(m.group(1)) / 1000.0

        # Load (N or kN)
        load = 500.0
        m = re.search(r'(\d+(?:\.\d+)?)\s*kn\b', text_lower)
        if m:
            load = float(m.group(1)) * 1000.0
        else:
            m = re.search(r'(\d+(?:\.\d+)?)\s*n\b', text_lower)
            if m:
                load = float(m.group(1))

        # Load position: default to end for cantilever, mid for simply supported
        load_pos = length if support_type == "cantilever" else length / 2.0

        # Beam width
        bw = 0.1
        m = re.search(r'width\s*[=:]?\s*(\d+(?:\.\d+)?)\s*(mm|m)?', text_lower)
        if m:
            val = float(m.group(1))
            unit = m.group(2) or "m"
            bw = val / 1000.0 if unit == "mm" or val > 1.0 else val

        # Beam height / depth
        bh = 0.1
        m = re.search(r'(?:height|depth|h)\s*[=:]?\s*(\d+(?:\.\d+)?)\s*(mm|m)?', text_lower)
        if m:
            val = float(m.group(1))
            unit = m.group(2) or "m"
            bh = val / 1000.0 if unit == "mm" or val > 1.0 else val

        # Material
        material = "Carbon Steel"
        for mat_key, mat_name in [
            ("steel", "Carbon Steel"), ("alumin", "Aluminum 6061"),
            ("titanium", "Titanium"), ("stainless", "SS304"),
        ]:
            if mat_key in text_lower:
                material = mat_name
                break

        params = {
            "length": length,
            "load_magnitude": load,
            "load_position": load_pos,
            "support_type": support_type,
            "material": material,
            "beam_width": bw,
            "beam_height": bh,
        }
        log.info(f"Regex extracted: {params}")
        return params
