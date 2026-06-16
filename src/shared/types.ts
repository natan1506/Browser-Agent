export type Role = 'user' | 'assistant' | 'system';

export interface AgentStep {
  id: string;
  action: ContentAction;
  status: 'running' | 'done' | 'error';
  preview?: string;
}

export interface FileAttachment {
  id: string;
  name: string;
  type: string;    // MIME type (image/jpeg, image/png, application/pdf, etc.)
  data: string;    // base64 data URL (e.g. data:image/png;base64,...)
  size: number;    // file size in bytes
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  steps?: AgentStep[];
  /** base64 data URL from captureVisibleTab — attached to tool-result messages for vision LLMs */
  screenshot?: string;
  /** User-uploaded files (images, PDFs) attached to this message */
  files?: FileAttachment[];
}

/** IDs of the built-in providers */
export type BuiltinProviderId =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'openrouter'
  | 'deepseek'
  | 'ollama'
  | 'groq';

/** String to allow custom provider IDs alongside the built-in ones */
export type ProviderId = string;

/** Which streaming API wire-format a provider uses */
export type ApiFormat =
  | 'openai'      // OpenAI-compatible (also OpenRouter, DeepSeek, Groq, most custom)
  | 'anthropic'
  | 'gemini'
  | 'openrouter'
  | 'deepseek'
  | 'ollama'
  | 'groq'
  | 'opencode';   // OpenCode local server (http://127.0.0.1:4096)

export interface ProviderConfig {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
  models: string[];
  selectedModel: string;
  /** API wire-format. Built-in providers don't need this (their id IS the format).
   *  Custom providers should set this explicitly (defaults to 'openai'). */
  apiFormat?: ApiFormat;
  /** True for user-created providers that can be deleted */
  isCustom?: boolean;
}

export interface FallbackConfig {
  provider: string;
  model: string;
}

export interface LLMConfig {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  /** Ordered list of provider+model pairs to try if the primary fails */
  fallbacks?: FallbackConfig[];
}

export interface Soul {
  name: string;
  prompt: string;
  language: string;
}

export interface AppState {
  messages: Message[];
  llmConfig: LLMConfig;
  providers: Record<string, ProviderConfig>;
  soul: Soul;
  isStreaming: boolean;
}

// 'search' → background opens a new tab; 'screenshot' → background captures visible tab
export type ActionType =
  | 'read'
  | 'click'
  | 'fill'
  | 'navigate'
  | 'scrape'
  | 'search'
  | 'screenshot'
  | 'press';

export interface ContentAction {
  type: ActionType;
  params: Record<string, unknown>;
}

export interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Port message protocol (side panel → background)
export type PortMessage =
  | { type: 'CHAT'; messages: Message[]; config: LLMConfig }
  | { type: 'ACTION'; action: ContentAction }
  | { type: 'ABORT' };

// Background → side panel
export type BackgroundReply =
  | { type: 'STREAM_CHUNK'; content: string }
  | { type: 'STREAM_END' }
  | { type: 'STREAM_ERROR'; error: string }
  | { type: 'ACTION_RESULT'; result: ActionResult }
  | { type: 'AGENT_ACTION'; action: ContentAction }
  | { type: 'AGENT_RESULT'; result: ActionResult };
