import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlanPhase = 'exploring' | 'designing' | 'reviewing' | 'ready';
export type StepStatus = 'pending' | 'in_progress' | 'completed';

export interface PlanStep {
  id: string;
  title: string;
  description?: string;
  status: StepStatus;
}

export interface Plan {
  title: string;
  context: string;
  phase: PlanPhase;
  steps: PlanStep[];
}

export interface PlanModeProps {
  plan: Plan;
  onApprove: () => void;
  onRequestChanges: (feedback: string) => void;
}

// ── Phase config ──────────────────────────────────────────────────────────────

const PHASE_ORDER: PlanPhase[] = ['exploring', 'designing', 'reviewing', 'ready'];

function phaseIndex(phase: PlanPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

// ── Step icon ─────────────────────────────────────────────────────────────────

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'completed') {
    return (
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#4ec9b0] text-[#1e1e1e]">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  if (status === 'in_progress') {
    return (
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#0e639c]">
        <span
          className="h-2 w-2 rounded-full bg-[#0e639c]"
          style={{ animation: 'pulse-dot 1.4s ease-in-out infinite' }}
        />
      </span>
    );
  }

  return (
    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#3e3e42]" />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PlanMode({ plan, onApprove, onRequestChanges }: PlanModeProps) {
  const { t } = useTranslation();
  const [feedbackMode, setFeedbackMode] = useState(false);
  const [feedback, setFeedback] = useState('');

  const completedSteps = plan.steps.filter((s) => s.status === 'completed').length;
  const totalSteps = plan.steps.length;
  const progressPct = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  const currentPhaseIdx = phaseIndex(plan.phase);
  const phaseProgressPct = ((currentPhaseIdx + 1) / PHASE_ORDER.length) * 100;

  const handleRequestChanges = () => {
    if (feedback.trim()) {
      onRequestChanges(feedback.trim());
      setFeedback('');
      setFeedbackMode(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded border border-[#3e3e42] bg-[#252526] p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[#4ec9b0]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M14 2H2L1 3v10l1 1h12l1-1V3l-1-1zM2 13V3h12v10H2zm2-2h8v-1H4v1zm0-3h8V7H4v1zm0-3h4V4H4v1z" />
            </svg>
          </span>
          <h3 className="text-sm font-semibold text-[#cccccc]">{plan.title}</h3>
        </div>
        <span className={`flex-shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
          plan.phase === 'ready'
            ? 'bg-[#1a3a1a] text-[#4ec9b0]'
            : 'bg-[#1a2a3a] text-[#569cd6]'
        }`}>
          {t(`plan.phase.${plan.phase}`)}
        </span>
      </div>

      {/* Context */}
      <p className="text-xs text-[#9d9d9d] leading-relaxed">{plan.context}</p>

      {/* Phase progress bar */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs text-[#6b6b6b]">{t('plan.phase.label')}</span>
          <span className="text-xs text-[#6b6b6b]">
            {currentPhaseIdx + 1} / {PHASE_ORDER.length}
          </span>
        </div>
        <div className="flex gap-1">
          {PHASE_ORDER.map((phase, idx) => (
            <div
              key={phase}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                idx <= currentPhaseIdx ? 'bg-[#0e639c]' : 'bg-[#3e3e42]'
              }`}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between">
          {PHASE_ORDER.map((phase) => (
            <span
              key={phase}
              className={`text-[10px] ${
                phase === plan.phase ? 'text-[#569cd6]' : 'text-[#6b6b6b]'
              }`}
            >
              {t(`plan.phase.${phase}`)}
            </span>
          ))}
        </div>
      </div>

      {/* Steps */}
      {plan.steps.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-[#9d9d9d]">{t('plan.steps')}</span>
            <span className="text-xs text-[#6b6b6b]">
              {completedSteps}/{totalSteps}
            </span>
          </div>

          {/* Step progress bar */}
          <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-[#3e3e42]">
            <div
              className="h-full rounded-full bg-[#4ec9b0] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {plan.steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-start gap-2 rounded px-2 py-1.5 ${
                step.status === 'in_progress' ? 'bg-[#1a2a3a]' : ''
              }`}
            >
              <StepIcon status={step.status} />
              <div className="flex flex-col gap-0.5 min-w-0">
                <span
                  className={`text-xs ${
                    step.status === 'completed'
                      ? 'text-[#6b6b6b] line-through'
                      : step.status === 'in_progress'
                      ? 'text-[#cccccc] font-medium'
                      : 'text-[#9d9d9d]'
                  }`}
                >
                  {step.title}
                </span>
                {step.description && step.status === 'in_progress' && (
                  <span className="text-[11px] text-[#6b6b6b]">{step.description}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Feedback input */}
      {feedbackMode && (
        <div className="flex flex-col gap-2">
          <textarea
            className="min-h-[80px] resize-none rounded border border-[#3e3e42] bg-[#1e1e1e] p-2 text-xs text-[#cccccc] placeholder-[#6b6b6b] outline-none focus:border-[#0e639c]"
            placeholder={t('plan.feedbackPlaceholder')}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setFeedbackMode(false); setFeedback(''); }}
              className="rounded px-3 py-1 text-xs text-[#9d9d9d] hover:bg-[#2a2d2e] hover:text-[#cccccc] transition-colors"
            >
              {t('plan.cancel')}
            </button>
            <button
              onClick={handleRequestChanges}
              disabled={!feedback.trim()}
              className="rounded bg-[#3e3e42] px-3 py-1 text-xs text-[#cccccc] hover:bg-[#4e4e52] transition-colors disabled:opacity-40"
            >
              {t('plan.submitFeedback')}
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!feedbackMode && (
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#3e3e42]">
          <button
            onClick={() => setFeedbackMode(true)}
            className="rounded px-3 py-1.5 text-xs text-[#9d9d9d] hover:bg-[#2a2d2e] hover:text-[#cccccc] transition-colors border border-[#3e3e42]"
          >
            {t('plan.requestChanges')}
          </button>
          <button
            onClick={onApprove}
            disabled={plan.phase !== 'ready'}
            className="rounded bg-[#0e639c] px-3 py-1.5 text-xs text-white hover:bg-[#1177bb] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('plan.approve')}
          </button>
        </div>
      )}
    </div>
  );
}
