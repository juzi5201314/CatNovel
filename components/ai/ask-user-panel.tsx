'use client';

import { useCallback } from 'react';
import { cx } from '@/lib/design/cx';

export interface Question {
  toolCallId: string;
  question: string;
  options?: string[];
  multiselect?: boolean;
  context?: string;
  type: 'choice' | 'text';
  response?: string;
  selectedOptions?: string[];
  otherInput?: string;
}

interface AskUserPanelProps {
  questions: Question[];
  activeQuestionId: string;
  onQuestionChange: (toolCallId: string) => void;
  onResponseChange: (toolCallId: string, response: string) => void;
  onMultiSelectChange: (toolCallId: string, selectedOptions: string[]) => void;
  onOtherInputChange: (toolCallId: string, value: string) => void;
  onSubmit: () => void;
  onSubmitSingle: (toolCallId: string) => void;
  isSubmitting: boolean;
}

function QuestionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const OTHER_OPTION = '其他';

function formatMultiSelectResponse(selectedOptions: string[], otherInput?: string): string {
  const hasOther = selectedOptions.includes(OTHER_OPTION);
  const mainOptions = selectedOptions.filter((o) => o !== OTHER_OPTION);
  
  if (hasOther && otherInput?.trim()) {
    return [...mainOptions, otherInput.trim()].join(', ');
  }
  
  return mainOptions.join(', ');
}

export function AskUserPanel({
  questions,
  activeQuestionId,
  onQuestionChange,
  onResponseChange,
  onMultiSelectChange,
  onOtherInputChange,
  onSubmit,
  onSubmitSingle,
  isSubmitting,
}: AskUserPanelProps) {
  const activeQuestion = questions.find((q) => q.toolCallId === activeQuestionId);
  
  const isQuestionAnswered = useCallback((q: Question) => {
    if (q.type === 'text') {
      return !!q.response?.trim();
    }
    if (q.multiselect) {
      const hasMainOptions = (q.selectedOptions?.length ?? 0) > 0;
      const hasOtherWithInput = q.selectedOptions?.includes(OTHER_OPTION) && q.otherInput?.trim();
      return hasMainOptions || hasOtherWithInput;
    }
    if (q.response === OTHER_OPTION) {
      return !!q.otherInput?.trim();
    }
    return !!q.response;
  }, []);
  
  const answeredCount = questions.filter(isQuestionAnswered).length;
  const allAnswered = answeredCount === questions.length;

  const handleSelectOption = useCallback((option: string) => {
    if (!activeQuestion || !activeQuestion.options) return;
    
    if (activeQuestion.multiselect) {
      const current = activeQuestion.selectedOptions ?? [];
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      onMultiSelectChange(activeQuestionId, next);
    } else {
      onResponseChange(activeQuestionId, option);
    }
  }, [activeQuestion, activeQuestionId, onResponseChange, onMultiSelectChange]);

  const handleTextSubmit = useCallback((toolCallId: string) => {
    const question = questions.find((q) => q.toolCallId === toolCallId);
    if (!question) return;
    
    if (question.type === 'text' && question.response?.trim()) {
      onSubmitSingle(toolCallId);
    }
  }, [questions, onSubmitSingle]);

  const handleChoiceSubmit = useCallback((toolCallId: string) => {
    const question = questions.find((q) => q.toolCallId === toolCallId);
    if (!question) return;
    
    if (question.multiselect) {
      const hasValidSelection = isQuestionAnswered(question);
      if (hasValidSelection) {
        const finalResponse = formatMultiSelectResponse(
          question.selectedOptions ?? [],
          question.otherInput
        );
        onResponseChange(toolCallId, finalResponse);
        onSubmitSingle(toolCallId);
      }
    } else if (question.response) {
      const finalResponse = question.response === OTHER_OPTION && question.otherInput
        ? question.otherInput
        : question.response;
      if (finalResponse.trim()) {
        onResponseChange(toolCallId, finalResponse);
        onSubmitSingle(toolCallId);
      }
    }
  }, [questions, onResponseChange, onSubmitSingle, isQuestionAnswered]);

  if (!activeQuestion) return null;

  const isMultiSelect = activeQuestion.multiselect;
  const hasValidResponse = isQuestionAnswered(activeQuestion);

  const selectedOptionsSet = new Set(activeQuestion.selectedOptions ?? []);

  return (
    <div className="bg-[var(--cn-bg)] border-t border-[var(--cn-border)] animate-fade-in">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--cn-border-soft)] bg-[var(--cn-bg-soft)]">
        <QuestionIcon className="w-4 h-4 text-[var(--cn-blue)]" />
        <span className="text-sm font-medium text-[var(--cn-text)]">
          AI 需要您的帮助
        </span>
        <span className="text-xs text-[var(--cn-text-muted)]">
          ({answeredCount}/{questions.length})
        </span>
        {isMultiSelect && (
          <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-[var(--cn-blue-tint)] text-[var(--cn-blue)]">
            多选
          </span>
        )}
        {allAnswered && (
          <span className="ml-auto text-xs text-green-600 font-medium">
            全部完成
          </span>
        )}
      </div>

      {questions.length > 1 && (
        <div className="flex gap-1 px-4 py-2 border-b border-[var(--cn-border-soft)] overflow-x-auto">
          {questions.map((q, index) => {
            const isActive = q.toolCallId === activeQuestionId;
            const isAnswered = isQuestionAnswered(q);
            
            return (
              <button
                key={q.toolCallId}
                onClick={() => onQuestionChange(q.toolCallId)}
                className={cx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0',
                  isActive
                    ? 'bg-[var(--cn-blue)] text-white'
                    : isAnswered
                      ? 'bg-green-50 text-green-600 border border-green-200'
                      : 'bg-[var(--cn-bg-muted)] text-[var(--cn-text-muted)] hover:text-[var(--cn-text)]'
                )}
              >
                {isAnswered && <CheckIcon className="w-3 h-3" />}
                <span>问题 {index + 1}</span>
                {q.multiselect && !isActive && (
                  <span className="text-[10px] opacity-70">多选</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="p-4 space-y-4 max-h-[300px] overflow-y-auto">
        {activeQuestion.context && (
          <div className="p-3 rounded-lg bg-[var(--cn-bg-muted)] text-sm text-[var(--cn-text-secondary)]">
            {activeQuestion.context}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-sm text-[var(--cn-text)] leading-relaxed">
              {activeQuestion.question}
            </p>
          </div>
          
          {isMultiSelect && (
            <p className="text-xs text-[var(--cn-text-muted)]">
              可选择多个选项
            </p>
          )}

          {activeQuestion.type === 'choice' && activeQuestion.options && (
            <div className="space-y-2">
              {[...activeQuestion.options, OTHER_OPTION].map((option, index) => {
                const isSelected = isMultiSelect
                  ? selectedOptionsSet.has(option)
                  : activeQuestion.response === option;
                const isOther = option === OTHER_OPTION;
                const showOtherInput = isOther && isSelected;
                
                return (
                  <div key={`${activeQuestion.toolCallId}-${index}`} className="space-y-2">
                    <button
                      onClick={() => handleSelectOption(option)}
                      className={cx(
                        'w-full px-3 py-2.5 text-left rounded-lg border transition-all text-sm',
                        isSelected
                          ? 'border-[var(--cn-blue)] bg-[var(--cn-blue-tint)] text-[var(--cn-blue-strong)]'
                          : 'border-[var(--cn-border)] bg-[var(--cn-bg)] text-[var(--cn-text)] hover:border-[var(--cn-blue)]/30'
                      )}
                    >
                      <span className="inline-flex items-center gap-2">
                        {isMultiSelect ? (
                          <span
                            className={cx(
                              'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                              isSelected
                                ? 'border-[var(--cn-blue)] bg-[var(--cn-blue)]'
                                : 'border-[var(--cn-border-strong)]'
                            )}
                          >
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </span>
                        ) : (
                          <span
                            className={cx(
                              'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                              isSelected
                                ? 'border-[var(--cn-blue)] bg-[var(--cn-blue)]'
                                : 'border-[var(--cn-border-strong)]'
                            )}
                          >
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </span>
                        )}
                        {option}
                      </span>
                    </button>
                    
                    {showOtherInput && (
                      <input
                        type="text"
                        value={activeQuestion.otherInput || ''}
                        onChange={(e) => onOtherInputChange(activeQuestionId, e.target.value)}
                        placeholder="请输入其他选项..."
                        className={cx(
                          'w-full px-3 py-2 rounded-lg border text-sm ml-6',
                          'bg-[var(--cn-bg)] border-[var(--cn-border)] text-[var(--cn-text)]',
                          'focus:outline-none focus:ring-2 focus:ring-[var(--cn-blue)]/30 focus:border-[var(--cn-blue)]',
                          'transition-all'
                        )}
                        autoFocus
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeQuestion.type === 'text' && (
            <div className="space-y-2">
              <textarea
                value={activeQuestion.response || ''}
                onChange={(e) => onResponseChange(activeQuestionId, e.target.value)}
                placeholder="请输入您的回答..."
                className={cx(
                  'w-full min-h-[80px] p-3 rounded-lg resize-y',
                  'bg-[var(--cn-bg-muted)] border border-[var(--cn-border)]',
                  'text-sm text-[var(--cn-text)] placeholder:text-[var(--cn-text-muted)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--cn-blue)]/30 focus:border-[var(--cn-blue)]'
                )}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-[var(--cn-border-soft)] bg-[var(--cn-bg-soft)]">
        <div className="flex items-center gap-2">
          {activeQuestion.type === 'text' ? (
            <button
              onClick={() => handleTextSubmit(activeQuestionId)}
              disabled={isSubmitting || !hasValidResponse}
              className={cx(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg',
                'bg-[var(--cn-blue)] text-white hover:bg-[var(--cn-blue-strong)]',
                'transition-all',
                (isSubmitting || !hasValidResponse) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isSubmitting ? (
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <SendIcon className="w-3 h-3" />
              )}
              发送
            </button>
          ) : (
            <button
              onClick={() => handleChoiceSubmit(activeQuestionId)}
              disabled={isSubmitting || !hasValidResponse}
              className={cx(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg',
                'bg-[var(--cn-blue)] text-white hover:bg-[var(--cn-blue-strong)]',
                'transition-all',
                (isSubmitting || !hasValidResponse) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isSubmitting ? (
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <CheckIcon className="w-3 h-3" />
              )}
              {isMultiSelect ? '确认选择' : '确认'}
            </button>
          )}
          
          {questions.length > 1 && allAnswered && (
            <button
              onClick={onSubmit}
              disabled={isSubmitting}
              className={cx(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg',
                'bg-green-600 text-white hover:bg-green-700',
                'transition-all',
                isSubmitting && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isSubmitting ? (
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <SendIcon className="w-3 h-3" />
              )}
              全部提交
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
