import { invoke } from '@tauri-apps/api/core';

/**
 * Typed wrappers around Tauri invoke() calls.
 * All commands are defined in src-tauri/src/lib.rs.
 */
export function useTauri() {
  async function sendMessage(params: {
    message: string;
    sessionId?: string;
    workingDirectory: string;
  }): Promise<{ id: number }> {
    return invoke('send_message', {
      message: params.message,
      sessionId: params.sessionId ?? null,
      workingDirectory: params.workingDirectory,
    });
  }

  async function cancelAgent(sessionId: string): Promise<void> {
    return invoke('cancel_agent', { sessionId });
  }

  async function getConfig(): Promise<{ id: number }> {
    return invoke('get_config');
  }

  async function setConfig(params: {
    provider?: Record<string, unknown>;
    agent?: Record<string, unknown>;
  }): Promise<void> {
    return invoke('set_config', {
      provider: params.provider ?? null,
      agent: params.agent ?? null,
    });
  }

  async function testProvider(params: {
    baseUrl: string;
    apiKey: string;
    model: string;
  }): Promise<{ id: number }> {
    return invoke('test_provider', {
      baseUrl: params.baseUrl,
      apiKey: params.apiKey,
      model: params.model,
    });
  }

  async function respondApproval(params: {
    id: string;
    approved: boolean;
    remember?: boolean;
  }): Promise<void> {
    return invoke('respond_approval', {
      id: params.id,
      approved: params.approved,
      remember: params.remember ?? null,
    });
  }

  return {
    sendMessage,
    cancelAgent,
    getConfig,
    setConfig,
    testProvider,
    respondApproval,
  };
}
