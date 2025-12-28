
export enum Role {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  timestamp: Date;
  media?: {
    type: 'image' | 'video' | 'audio';
    url: string;
  };
  sources?: GroundingSource[];
  isThinking?: boolean;
}

export enum AppMode {
  CHAT = 'chat',
  IMAGE = 'image',
  VIDEO = 'video',
  LIVE = 'live'
}
