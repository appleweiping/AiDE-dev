import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TokenUsageProps {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

// ── Pricing table (USD per 1M tokens) ────────────────────────────────────────

const PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4': { input: 15, output: 75 },
  'claude-opus-4-5': { input: 15, output: 75 },
  'claude-sonnet-4': { input: 3, output: 15 },
  'claude-sonnet-4-5': { input: 3, output: 15 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-3-5': { input: 0.8, output: 4 },
  'claude-haiku-3': { input: 0.25, output: 1.25 },
  'gpt-4o': { input: 5, output: 15 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'deepseek-chat': { input: 0.27, output: 1.1 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
};

function getPricing(model: string) {
  // Exact match first
  if (PRICING[model]) return PRICING[model];
  // Prefix match
  const key = Object.keys(PRICING).find((k) => model.startsWith(k));
  return key ? PRICING[key] : { input: 3, output: 15 };
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(usd: number): string {
  if (usd < 0.001) return '<$0.001';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

// ── Mini bar chart ────────────────────────────────────────────────────────────

function MiniBar({
  inputTokens,
  outputTokens,
}: {
  inputTokens: number;
  outputTokens: number;
}) {
  const total = inputTokens + outputTokens;
  if (total === 0) return null;

  const inputPct = (inputTokens / total) * 100;
  const outputPct = (outputTokens / total) * 100;

  return (
    <div className="flex h-1.5 w-16 overflow-hidden rounded-full bg-[#3e3e42]" title={`Input: ${inputPct.toFixed(0)}% / Output: ${outputPct.toFixed(0)}%`}>
      <div
        className="h-full bg-[#569cd6] transition-all duration-300"
        style={{ width: `${inputPct}%` }}
      />
      <div
        className="h-full bg-[#4ec9b0] transition-all duration-300"
        style={{ width: `${outputPct}%` }}
      />
    </div>
  );
}

// ── Tooltip breakdown ─────────────────────────────────────────────────────────

function TokenTooltip({
  inputTokens,
  outputTokens,
  inputCost,
  outputCost,
  totalCost,
  model,
}: {
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  model: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="absolute bottom-full right-0 mb-2 w-56 rounded border border-[#3e3e42] bg-[#252526] p-3 shadow-xl text-xs z-50">
      <div className="mb-2 font-semibold text-[#cccccc]">{t('tokenUsage.breakdown')}</div>
      <div className="mb-1 text-[#6b6b6b] truncate">{model}</div>

      <div className="flex flex-col gap-1 mt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#569cd6]" />
            <span className="text-[#9d9d9d]">{t('tokenUsage.input')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#cccccc]">{formatTokens(inputTokens)}</span>
            <span className="text-[#6b6b6b]">{formatCost(inputCost)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#4ec9b0]" />
            <span className="text-[#9d9d9d]">{t('tokenUsage.output')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#cccccc]">{formatTokens(outputTokens)}</span>
            <span className="text-[#6b6b6b]">{formatCost(outputCost)}</span>
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between border-t border-[#3e3e42] pt-1">
          <span className="font-medium text-[#9d9d9d]">{t('tokenUsage.total')}</span>
          <div className="flex items-center gap-2">
            <span className="font-medium text-[#cccccc]">
              {formatTokens(inputTokens + outputTokens)}
            </span>
            <span className="font-medium text-[#dcdcaa]">{formatCost(totalCost)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TokenUsage({ inputTokens, outputTokens, model }: TokenUsageProps) {
  const { t } = useTranslation();
  const [showTooltip, setShowTooltip] = useState(false);

  const pricing = useMemo(() => getPricing(model), [model]);

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const totalCost = inputCost + outputCost;
  const totalTokens = inputTokens + outputTokens;

  return (
    <div className="relative flex items-center gap-2">
      <button
        className="flex items-center gap-2 rounded px-2 py-0.5 hover:bg-[#2a2d2e] transition-colors"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip((v) => !v)}
        title={t('tokenUsage.title')}
        aria-label={t('tokenUsage.title')}
      >
        {/* Bar chart */}
        <MiniBar inputTokens={inputTokens} outputTokens={outputTokens} />

        {/* Token count */}
        <span className="text-[11px] text-[#9d9d9d]">
          {formatTokens(totalTokens)} {t('tokenUsage.tokens')}
        </span>

        {/* Cost */}
        {totalCost > 0 && (
          <span className="text-[11px] text-[#dcdcaa]">{formatCost(totalCost)}</span>
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && totalTokens > 0 && (
        <TokenTooltip
          inputTokens={inputTokens}
          outputTokens={outputTokens}
          inputCost={inputCost}
          outputCost={outputCost}
          totalCost={totalCost}
          model={model}
        />
      )}
    </div>
  );
}
