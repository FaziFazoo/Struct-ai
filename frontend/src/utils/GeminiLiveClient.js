/**
 * GeminiLiveClient
 * Manages WebSocket connection to Gemini Multimodal Live API
 */

export class GeminiLiveClient {
  constructor(apiKey, model = "gemini-2.0-flash-exp") {
    this.apiKey = apiKey;
    this.model = "gemini-2.0-flash-exp"; // Forced for Live Multimodal stability
    this.ws = null;
    this.onMessage = null;
    this.onError = null;
    this.onClose = null;
    this.audioContext = null;
  }

  async connect() {
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
    
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log("[GeminiLive] WebSocket Connected");
      this.sendSetup();
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (this.onMessage) this.onMessage(data);
    };

    this.ws.onerror = (e) => {
      console.error("[GeminiLive] WebSocket Error", e);
      if (this.onError) this.onError(e);
    };
    this.ws.onclose = () => {
      console.log("[GeminiLive] WebSocket Closed");
      if (this.onClose) this.onClose();
    };
  }

  sendSetup() {
    const setup = {
      setup: {
        model: `models/${this.model}`,
        generation_config: {
          response_modalities: ["audio"],
          speech_config: {
            voice_config: { prebuilt_voice_config: { voice_name: "Puck" } }
          }
        },
        input_audio_transcription: {
          config: {
            language_code: "en-US"
          }
        },
        tools: [
          {
            function_declarations: [
              {
                name: "analyze_beam",
                description: "Run a structural analysis on a beam with given parameters.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    length: { type: "NUMBER", description: "Length in metres" },
                    load: { type: "NUMBER", description: "Point load in Newtons" },
                    load_position: { type: "NUMBER", description: "Position of load from left in metres" },
                    type: { type: "STRING", enum: ["cantilever", "simply_supported"] },
                    material: { type: "STRING", description: "Material name (e.g. Steel, Aluminum)" },
                    width: { type: "NUMBER", description: "Beam width in metres" },
                    height: { type: "NUMBER", description: "Beam height in metres" }
                  },
                  required: ["length", "load", "type"]
                }
              }
            ]
          }
        ],
        system_instruction: {
          parts: [{ text: "You are S.T.R.U.C.T, an expert structural engineering copilot. You can analyze beams, materials, and safety factors. When a user describes a beam, always use the analyze_beam tool to compute results. Be concise and professional." }]
        }
      }
    };
    const setupStr = JSON.stringify(setup);
    console.log("[GeminiLive] Sending Setup:", setupStr);
    this.ws.send(setupStr);
  }

  sendAudioChunk(base64Audio) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        realtime_input: {
          media_chunks: [{ mime_type: "audio/pcm;rate=16000", data: base64Audio }]
        }
      }));
    }
  }

  sendText(text) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        client_content: {
          turns: [{ role: "user", parts: [{ text }] }],
          turn_complete: true
        }
      }));
    }
  }

  disconnect() {
    if (this.ws) this.ws.close();
  }
}
