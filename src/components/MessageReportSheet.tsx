import { useState } from 'react';
import { ABUSE_REPORT_CATEGORY_OPTIONS, type AbuseReportCategory } from '@/lib/trustSafety';

export interface MessageReportSubmission {
  category: AbuseReportCategory;
  details: string;
}

export interface MessageReportContext {
  targetScreenname: string;
  messagePreview?: string | null;
}

interface MessageReportSheetProps {
  isOpen: boolean;
  context: MessageReportContext | null;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: (payload: MessageReportSubmission) => void | Promise<void>;
}

export default function MessageReportSheet({
  isOpen,
  context,
  isSubmitting = false,
  errorMessage = null,
  onClose,
  onSubmit,
}: MessageReportSheetProps) {
  const [category, setCategory] = useState<AbuseReportCategory>('harassment');
  const [details, setDetails] = useState('');

  if (!isOpen || !context) {
    return null;
  }

  const helper = ABUSE_REPORT_CATEGORY_OPTIONS.find((option) => option.value === category)?.helper;
  const trimmedPreview = (context.messagePreview ?? '').trim();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="message-report-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 px-4 pb-8 pt-12 backdrop-blur-sm sm:items-center"
      data-testid="message-report-sheet"
    >
      <div className="w-full max-w-sm rounded-[1.6rem] border border-slate-200/80 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-[#0F1424]">
        <h2
          id="message-report-title"
          className="text-[18px] font-semibold text-slate-900 dark:text-slate-50"
        >
          Report message
        </h2>
        <p className="mt-1 text-[13px] leading-5 text-slate-500 dark:text-slate-400">
          Reporting <strong>{context.targetScreenname}</strong>. Our team will review the message
          and take action if it violates our policies.
        </p>

        {trimmedPreview ? (
          <p
            className="mt-3 rounded-[1.2rem] border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-[12px] text-slate-600 dark:border-slate-700 dark:bg-[#181D32] dark:text-slate-300"
            data-testid="message-report-preview"
          >
            “{trimmedPreview.length > 160 ? `${trimmedPreview.slice(0, 159)}…` : trimmedPreview}”
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="message-report-category" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Category
            </label>
            <select
              id="message-report-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as AbuseReportCategory)}
              disabled={isSubmitting}
              className="ui-focus-ring w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-700 dark:border-slate-700 dark:bg-[#0F1424] dark:text-slate-100"
              data-testid="message-report-category"
              aria-describedby={helper ? 'message-report-category-help' : undefined}
            >
              {ABUSE_REPORT_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {helper ? (
              <p id="message-report-category-help" className="mt-1 text-[11px] text-slate-400">{helper}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="message-report-notes" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Notes (optional)
            </label>
            <textarea
              id="message-report-notes"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={3}
              maxLength={1200}
              disabled={isSubmitting}
              placeholder="Add details to help with review."
              className="ui-focus-ring w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-700 placeholder-slate-400 dark:border-slate-700 dark:bg-[#0F1424] dark:text-slate-100 dark:placeholder-slate-500"
              data-testid="message-report-notes"
            />
          </div>

          {errorMessage ? (
            <p
              role="alert"
              className="rounded-[1.2rem] border border-red-200/80 bg-red-50/90 px-3 py-2 text-[13px] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
            >
              {errorMessage}
            </p>
          ) : null}

          <div className="mt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                void onSubmit({ category, details: details.trim() });
              }}
              disabled={isSubmitting}
              className="ui-focus-ring min-h-[44px] w-full rounded-2xl bg-red-600 px-4 py-2 text-[14px] font-semibold text-white transition active:scale-[0.99] disabled:opacity-50 hover:bg-red-700"
              data-testid="message-report-submit"
            >
              {isSubmitting ? 'Sending…' : 'Send report'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="ui-focus-ring min-h-[44px] w-full rounded-2xl border border-slate-300/80 bg-white/70 px-4 py-2 text-[14px] font-semibold text-slate-700 transition active:scale-[0.99] disabled:opacity-50 hover:bg-white dark:border-slate-700 dark:bg-[#0F1424]/70 dark:text-slate-200"
              data-testid="message-report-cancel"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
