import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();

router.post('/', async (req, res) => {
  const { message, model, apiKey } = req.body;
  
  // Use server key if no client API key provided
  const keyToUse = apiKey || process.env.GEMINI_API_KEY;
  
  if (!keyToUse) {
    return res.status(400).json({ error: 'API Key missing' });
  }

  try {
    const genAI = new GoogleGenerativeAI(keyToUse);
    const genModel = genAI.getGenerativeModel({ model: model || "gemini-1.5-flash" });
    
    // For simplicity in this first pass, we'll return a full response
    // We can upgrade to streaming later if needed
    const result = await genModel.generateContent(message);
    const response = await result.response;
    const text = response.text();
    
    res.json({ text });
  } catch (error) {
    console.error('LLM Error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

export default router;
