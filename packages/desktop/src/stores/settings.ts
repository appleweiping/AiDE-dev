import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PermissionMode } from '@aide/shared';
import { PROVIDER_PRESETS } from '@aide/shared';

export interface ProviderSettings {
  id: string;
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface SettingsState {
  // Provider
  provider: ProviderSettings;

  // Agent behavior
  maxIterations: number;
  thinkingEnabled: boolean;
  thinkingEffort: 'low' | 'medium' | 'high';
  permissionMode: PermissionMode;
  workingDirectory: string;

  // UI
  language: 'en' | 'zh-CN';
  fontSize: number;

  // Actions
  setProvider: (provider: Partial<ProviderSettings>) => void;
  setMaxIterations: (n: number) => void;
  setThinkingEnabled: (enabled: boolean) => void;
  setThinkingEffort: (effort: 'low' | 'medium' | 'high') => void;
  setPermissionMode: (mode: PermissionMode) => void;
  setWorkingDirectory: (dir: string) => void;
  setLanguage: (lang: 'en' | 'zh-CN') => void;
  setFontSize: (size: number) => void;
}

const defaultProvider = PROVIDER_PRESETS[0];

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      provider: {
        id: defaultProvider.id,
        apiKey: '',
        model: defaultProvider.models[0].id,
        baseUrl: defaultProvider.baseUrl,
      },
      maxIterations: 50,
      thinkingEnabled: false,
      thinkingEffort: 'medium',
      permissionMode: 'safe',
      workingDirectory: '',
      language: 'zh-CN',
      fontSize: 14,

      setProvider: (partial) =>
        set((state) => ({
          provider: { ...state.provider, ...partial },
        })),

      setMaxIterations: (n) => set({ maxIterations: n }),

      setThinkingEnabled: (enabled) => set({ thinkingEnabled: enabled }),

      setThinkingEffort: (effort) => set({ thinkingEffort: effort }),

      setPermissionMode: (mode) => set({ permissionMode: mode }),

      setWorkingDirectory: (dir) => set({ workingDirectory: dir }),

      setLanguage: (lang) => set({ language: lang }),

      setFontSize: (size) => set({ fontSize: size }),
    }),
    {
      name: 'aide-settings',
      // Don't persist the API key in plain localStorage in production;
      // for now we persist everything for convenience during development.
      partialize: (state) => ({
        provider: state.provider,
        maxIterations: state.maxIterations,
        thinkingEnabled: state.thinkingEnabled,
        thinkingEffort: state.thinkingEffort,
        permissionMode: state.permissionMode,
        workingDirectory: state.workingDirectory,
        language: state.language,
        fontSize: state.fontSize,
      }),
    },
  ),
);
