// Minimal ambient declarations for the `ai/react` package used in this project.
// This prevents TypeScript's "Cannot find module 'ai/react'" error while
// the upstream package types are not available or the editor hasn't picked
// them up yet.

declare module 'ai/react' {
  export type AIMessage = {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content?: string;
    toolInvocations?: any[];
    [key: string]: any;
  };

  export type UseChatOptions = {
    api?: string;
    body?: any;
    initialMessages?: AIMessage[];
    [key: string]: any;
  };

  export function useChat(opts?: UseChatOptions): {
    messages: AIMessage[];
    input: string;
    handleInputChange: (e: any) => void;
    handleSubmit: (e?: any) => void;
    isLoading: boolean;
    data?: any;
  };

  export default useChat;
}
