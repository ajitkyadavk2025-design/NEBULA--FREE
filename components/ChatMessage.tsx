
import React from 'react';
import { ChatMessage as ChatMessageType, Role } from '../types';

interface ChatMessageProps {
  message: ChatMessageType;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === Role.USER;

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] md:max-w-[70%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        {!isUser && (
          <div className="flex items-center space-x-2 mb-1 ml-1">
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-400 to-purple-600 flex items-center justify-center text-[10px] font-bold">
              AI
            </div>
            <span className="text-xs text-gray-400 font-medium">Nebula</span>
          </div>
        )}
        
        <div className={`glass p-4 rounded-2xl ${isUser ? 'rounded-tr-none bg-white/10' : 'rounded-tl-none'}`}>
          {message.text && (
            <p className="text-sm md:text-base whitespace-pre-wrap leading-relaxed">
              {message.text}
            </p>
          )}

          {message.isThinking && (
             <div className="flex items-center space-x-1 py-2">
                <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce [animation-delay:0.4s]"></div>
             </div>
          )}

          {message.media && (
            <div className="mt-3 rounded-xl overflow-hidden shadow-xl border border-white/10">
              {message.media.type === 'image' && (
                <img src={message.media.url} alt="Generated" className="w-full h-auto max-h-[400px] object-contain" />
              )}
              {message.media.type === 'video' && (
                <video src={message.media.url} controls className="w-full h-auto max-h-[400px]" />
              )}
            </div>
          )}
        </div>

        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.sources.map((source, idx) => (
              <a 
                key={idx} 
                href={source.uri} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/10 px-2 py-1 rounded-full text-gray-400 hover:text-white transition-colors flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {source.title.length > 20 ? source.title.substring(0, 20) + '...' : source.title}
              </a>
            ))}
          </div>
        )}
        
        <span className="text-[10px] text-gray-500 mt-1 px-1">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
};

export default ChatMessage;
