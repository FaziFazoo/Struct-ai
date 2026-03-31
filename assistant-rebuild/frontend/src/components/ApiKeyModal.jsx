import React, { useState } from 'react';
import { Key, ShieldAlert } from 'lucide-react';

const ApiKeyModal = ({ onSave }) => {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!key.trim()) {
      setError('Please enter a valid API key');
      return;
    }
    onSave(key);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md p-8 bg-[#111] border border-white/10 rounded-3xl shadow-2xl">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="p-4 bg-blue-500/10 rounded-full">
            <Key className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Security Check</h2>
          <p className="text-sm text-zinc-400">
            Welcome to S.T.R.U.C.T. To keep your data secure, please enter your Gemini API Key. 
            It will be stored safely in your browser and never on any server.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="relative group">
            <input
              type="password"
              placeholder="Enter Gemini API Key..."
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full px-5 py-4 bg-zinc-900/50 border border-white/5 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm group-hover:border-white/20"
            />
          </div>
          
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
              <ShieldAlert className="w-4 h-4" />
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-medium transition-colors text-sm"
          >
            Start Assistant
          </button>
        </form>

        <p className="mt-6 text-[10px] text-center text-zinc-600">
          By continuing, you agree to secure local storage of your credentials.
        </p>
      </div>
    </div>
  );
};

export default ApiKeyModal;
