/**
 * voice.ts — Voice input and TTS output
 *
 * Voice input: Web Speech API (desktop webview) or node-microphone + whisper
 * TTS output: Chinese providers (Alibaba TTS, iFlytek) + system TTS fallback
 *
 * This module provides:
 * 1. VoiceManager — manages recording state and TTS playback
 * 2. Tool factories for agent use
 */

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// TTS providers
// ---------------------------------------------------------------------------

export type TtsProvider = 'system' | 'edge-tts' | 'custom';

export interface TtsOptions {
  provider?: TtsProvider;
  voice?: string;
  rate?: number;   // speech rate, 0.5–2.0
  pitch?: number;  // pitch, 0.5–2.0
  /** Custom TTS endpoint (OpenAI-compatible /v1/audio/speech) */
  customEndpoint?: string;
  customApiKey?: string;
}

export class VoiceManager {
  private ttsOptions: TtsOptions;

  constructor(options: TtsOptions = {}) {
    this.ttsOptions = options;
  }

  /** Speak text using the configured TTS provider */
  async speak(text: string): Promise<void> {
    const provider = this.ttsOptions.provider ?? 'system';

    if (provider === 'edge-tts') {
      await this.speakEdgeTts(text);
    } else if (provider === 'custom' && this.ttsOptions.customEndpoint) {
      await this.speakCustomApi(text);
    } else {
      await this.speakSystem(text);
    }
  }

  private async speakSystem(text: string): Promise<void> {
    const platform = process.platform;
    if (platform === 'darwin') {
      await execFileAsync('say', [text]);
    } else if (platform === 'win32') {
      const ps = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Speak('${text.replace(/'/g, "''")}')`;
      await execFileAsync('powershell', ['-Command', ps]);
    } else {
      // Linux: try espeak, then festival
      try {
        await execFileAsync('espeak', [text]);
      } catch {
        await execFileAsync('festival', ['--tts'], { input: text } as any);
      }
    }
  }

  private async speakEdgeTts(text: string): Promise<void> {
    const voice = this.ttsOptions.voice ?? 'zh-CN-XiaoxiaoNeural';
    const outFile = join(tmpdir(), `aide-tts-${randomUUID()}.mp3`);
    try {
      await execFileAsync('edge-tts', ['--voice', voice, '--text', text, '--write-media', outFile]);
      await this.playAudioFile(outFile);
    } finally {
      await unlink(outFile).catch(() => {});
    }
  }

  private async speakCustomApi(text: string): Promise<void> {
    const res = await fetch(`${this.ttsOptions.customEndpoint}/v1/audio/speech`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.ttsOptions.customApiKey ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: this.ttsOptions.voice ?? 'alloy',
      }),
    });
    if (!res.ok) throw new Error(`TTS API error: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const outFile = join(tmpdir(), `aide-tts-${randomUUID()}.mp3`);
    try {
      await writeFile(outFile, buf);
      await this.playAudioFile(outFile);
    } finally {
      await unlink(outFile).catch(() => {});
    }
  }

  private async playAudioFile(path: string): Promise<void> {
    const platform = process.platform;
    if (platform === 'darwin') {
      await execFileAsync('afplay', [path]);
    } else if (platform === 'win32') {
      await execFileAsync('powershell', ['-Command', `(New-Object Media.SoundPlayer '${path}').PlaySync()`]);
    } else {
      try {
        await execFileAsync('mpg123', [path]);
      } catch {
        await execFileAsync('aplay', [path]);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Tool factories
// ---------------------------------------------------------------------------

import type { ToolDefinition } from '@aide/shared';
import type { ToolResult } from './registry.js';

export function createTtsTool(voiceManager: VoiceManager): ToolDefinition & {
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
} {
  return {
    name: 'tts_speak',
    description: 'Convert text to speech and play it through the system audio output.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to speak aloud' },
      },
      required: ['text'],
    },
    async execute(args) {
      try {
        await voiceManager.speak(args.text as string);
        return { output: `Speaking: ${(args.text as string).slice(0, 100)}`, isError: false };
      } catch (err) {
        return { output: `TTS failed: ${err instanceof Error ? err.message : String(err)}`, isError: true };
      }
    },
  };
}
