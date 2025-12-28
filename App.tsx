
import React, { useState, useRef, useEffect } from 'react';
import { Role, ChatMessage as ChatMessageType, AppMode } from './types';
import * as GeminiService from './services/geminiService';
import ChatMessage from './components/ChatMessage';

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      id: 'welcome',
      role: Role.MODEL,
      text: "Welcome to Nebula. How can I assist you today? I can chat, generate images, create videos, or even talk in real-time.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<AppMode>(AppMode.CHAT);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Audio state for Live Mode
  const [isLiveActive, setIsLiveActive] = useState(false);
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const addMessage = (msg: Omit<ChatMessageType, 'id' | 'timestamp'>) => {
    const newMsg: ChatMessageType = {
      ...msg,
      id: Math.random().toString(36).substring(7),
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMsg]);
    return newMsg.id;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input;
    setInput('');
    addMessage({ role: Role.USER, text: userText });
    setIsLoading(true);

    try {
      if (mode === AppMode.CHAT) {
        const thinkingId = addMessage({ role: Role.MODEL, text: '', isThinking: true });
        const response = await GeminiService.generateText(userText, messages);
        
        // Extract grounding
        const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
          title: chunk.web?.title || chunk.maps?.title || 'Source',
          uri: chunk.web?.uri || chunk.maps?.uri || '#'
        })).filter(Boolean) || [];

        setMessages(prev => prev.map(m => m.id === thinkingId ? {
          ...m,
          text: response.text || "I couldn't process that.",
          isThinking: false,
          sources
        } : m));

      } else if (mode === AppMode.IMAGE) {
        const thinkingId = addMessage({ role: Role.MODEL, text: 'Generating your image...', isThinking: true });
        const imageUrl = await GeminiService.generateImage(userText);
        
        setMessages(prev => prev.map(m => m.id === thinkingId ? {
          ...m,
          text: 'Here is your generated image:',
          isThinking: false,
          media: imageUrl ? { type: 'image', url: imageUrl } : undefined
        } : m));

      } else if (mode === AppMode.VIDEO) {
        // Veo requires API key selection
        // @ts-ignore
        const hasKey = await window.aistudio?.hasSelectedApiKey();
        if (!hasKey) {
          // @ts-ignore
          await window.aistudio?.openSelectKey();
        }

        const thinkingId = addMessage({ role: Role.MODEL, text: 'Synthesizing video (this may take a few minutes)...', isThinking: true });
        const videoUrl = await GeminiService.generateVideo(userText);

        setMessages(prev => prev.map(m => m.id === thinkingId ? {
          ...m,
          text: videoUrl ? 'Your video is ready:' : 'Failed to generate video. Ensure you have a paid API key selected.',
          isThinking: false,
          media: videoUrl ? { type: 'video', url: videoUrl } : undefined
        } : m));
      }
    } catch (error: any) {
      console.error(error);
      addMessage({ role: Role.MODEL, text: `Error: ${error.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLiveMode = async () => {
    if (isLiveActive) {
      liveSessionRef.current?.close();
      setIsLiveActive(false);
      return;
    }

    try {
      setIsLiveActive(true);
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      let nextStartTime = 0;
      const sources = new Set<AudioBufferSourceNode>();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = GeminiService.startLiveSession({
        onopen: () => {
          const source = inputCtx.createMediaStreamSource(stream);
          const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
          scriptProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const l = inputData.length;
            const int16 = new Int16Array(l);
            for (let i = 0; i < l; i++) {
              int16[i] = inputData[i] * 32768;
            }
            const pcmBlob = {
              data: GeminiService.encodeAudio(new Uint8Array(int16.buffer)),
              mimeType: 'audio/pcm;rate=16000',
            };
            sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
          };
          source.connect(scriptProcessor);
          scriptProcessor.connect(inputCtx.destination);
        },
        onmessage: async (message: any) => {
          const audioStr = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audioStr) {
            nextStartTime = Math.max(nextStartTime, outputCtx.currentTime);
            const audioBuffer = await GeminiService.decodeAudioData(
              GeminiService.decodeAudio(audioStr),
              outputCtx,
              24000,
              1
            );
            const source = outputCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputCtx.destination);
            source.start(nextStartTime);
            nextStartTime += audioBuffer.duration;
            sources.add(source);
          }

          if (message.serverContent?.interrupted) {
            sources.forEach(s => s.stop());
            sources.clear();
            nextStartTime = 0;
          }
        },
        onerror: (e: any) => {
          console.error("Live Error", e);
          setIsLiveActive(false);
        },
        onclose: () => {
          setIsLiveActive(false);
        }
      });

      liveSessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
      setIsLiveActive(false);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col relative overflow-hidden animate-gradient bg-gradient-to-br from-indigo-900 via-slate-900 to-black">
      
      {/* Navbar */}
      <nav className="glass sticky top-0 z-50 px-6 py-4 flex justify-between items-center shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-purple-600 shadow-lg shadow-blue-500/20 flex items-center justify-center font-bold text-lg">N</div>
          <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Nebula</h1>
        </div>
        
        <div className="flex items-center space-x-2 bg-white/5 p-1 rounded-full border border-white/10">
          {(Object.values(AppMode) as AppMode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                if (m === AppMode.LIVE) toggleLiveMode();
                else setMode(m);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
                (m === AppMode.LIVE ? isLiveActive : mode === m)
                  ? 'bg-white text-black shadow-lg' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              } ${m === AppMode.LIVE && isLiveActive ? 'animate-pulse bg-red-500 text-white' : ''}`}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Chat Area */}
      <main 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 md:px-0 py-8 w-full max-w-4xl mx-auto space-y-4"
      >
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isLoading && mode === AppMode.CHAT && (
           <div className="flex justify-start w-full">
             <div className="glass p-4 rounded-2xl rounded-tl-none max-w-[70%]">
               <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
               </div>
             </div>
           </div>
        )}
      </main>

      {/* Input Bar Area */}
      <footer className="w-full max-w-4xl mx-auto pb-6 px-4 shrink-0">
        <form 
          onSubmit={handleSubmit}
          className="glass rounded-3xl p-2 pl-6 flex items-center shadow-2xl shadow-black/40 border border-white/20 transition-all focus-within:ring-2 focus-within:ring-blue-500/50"
        >
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading || isLiveActive}
            placeholder={
              mode === AppMode.IMAGE ? "Describe an image to generate..." : 
              mode === AppMode.VIDEO ? "Describe a video to create..." : 
              "Ask Nebula anything..."
            }
            className="flex-1 bg-transparent border-none outline-none text-white text-base py-3 placeholder-gray-500"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isLoading || isLiveActive}
            className={`p-3 rounded-2xl ml-2 transition-all ${
              input.trim() && !isLoading && !isLiveActive
              ? 'bg-white text-black scale-100 hover:scale-105 active:scale-95' 
              : 'bg-white/5 text-gray-600 scale-100'
            }`}
          >
            {isLoading ? (
               <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
               </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        </form>
        <p className="text-[10px] text-center text-gray-500 mt-2 font-medium tracking-wide uppercase opacity-60">
          Nebula may provide inaccurate info. Verify important facts. Powered by Gemini API.
        </p>
      </footer>

      {/* Floating Visualizers for Live Mode */}
      {isLiveActive && (
        <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center pointer-events-none">
          <div className="flex items-center space-x-4 mb-8">
            {[...Array(5)].map((_, i) => (
              <div 
                key={i} 
                className="w-2 bg-gradient-to-t from-blue-500 to-purple-500 rounded-full animate-pulse"
                style={{ 
                  height: `${Math.random() * 80 + 20}px`,
                  animationDuration: `${Math.random() * 0.5 + 0.5}s`
                }}
              />
            ))}
          </div>
          <p className="text-white text-xl font-bold tracking-widest animate-pulse">LIVE CONVERSATION ACTIVE</p>
          <button 
            onClick={toggleLiveMode}
            className="mt-8 px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold pointer-events-auto transition-transform hover:scale-105 active:scale-95 shadow-xl"
          >
            END SESSION
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
