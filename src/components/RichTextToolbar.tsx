'use client';

import {
  AIM_COLOR_OPTIONS,
  AIM_FONT_OPTIONS,
  DEFAULT_RICH_TEXT_FORMAT,
  RichTextFormat,
  isDefaultRichTextFormat,
} from '@/lib/richText';

interface RichTextToolbarProps {
  value: RichTextFormat;
  onChange: (nextValue: RichTextFormat) => void;
}

export default function RichTextToolbar({ value, onChange }: RichTextToolbarProps) {
  const updateValue = (partial: Partial<RichTextFormat>) => {
    onChange({
      ...value,
      ...partial,
    });
  };
  const selectedColor = AIM_COLOR_OPTIONS.find(
    (option) => option.value.toLowerCase() === value.color.toLowerCase(),
  ) ?? AIM_COLOR_OPTIONS[0];
  const hasCustomStyling = !isDefaultRichTextFormat(value);
  const previewUsesDarkSurface = new Set([
    '#FFFFFF',
    '#C0C0C0',
    '#FFD400',
    '#00FFFF',
    '#00FF00',
    '#7CFC00',
  ]).has(selectedColor.value.toUpperCase());

  return (
    <div className="ui-toolbar-surface rounded-2xl px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
            Text Style
          </p>
          <p className="mt-1 text-[12px] text-slate-600 dark:text-slate-300">
            {value.fontFamily} · {selectedColor.name}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_RICH_TEXT_FORMAT)}
          disabled={!hasCustomStyling}
          className="ui-focus-ring ui-button-secondary ui-button-compact disabled:opacity-50"
        >
          Reset
        </button>
      </div>

      <div className="mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
          Font
        </p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {AIM_FONT_OPTIONS.map((fontName) => {
            const isActive = value.fontFamily === fontName;
            return (
              <button
                key={fontName}
                type="button"
                onClick={() => updateValue({ fontFamily: fontName })}
                className={`ui-focus-ring shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                  isActive
                    ? 'border-[#A78BFA]/40 bg-[#A78BFA] text-white shadow-[0_10px_20px_rgba(167,139,250,0.24)]'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#13100E]/65 dark:text-slate-200 dark:hover:bg-[#13100E]'
                }`}
                style={{ fontFamily: fontName }}
                aria-pressed={isActive}
              >
                {fontName}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
          Color
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {AIM_COLOR_OPTIONS.map((color) => {
            const isActive = value.color.toLowerCase() === color.value.toLowerCase();
            return (
              <button
                key={color.value}
                type="button"
                title={color.name}
                aria-label={color.name}
                onClick={() => updateValue({ color: color.value })}
                className={`ui-focus-ring flex h-8 w-8 items-center justify-center rounded-full border transition ${
                  isActive
                    ? 'border-blue-500 shadow-[0_0_0_2px_rgba(191,219,254,0.9)] dark:shadow-[0_0_0_2px_rgba(59,130,246,0.35)]'
                    : 'border-slate-300 hover:scale-105 dark:border-slate-600'
                }`}
                aria-pressed={isActive}
              >
                <span
                  className="h-5 w-5 rounded-full border border-white/70 shadow-sm"
                  style={{ backgroundColor: color.value }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-[#13100E]/55">
        <p className="text-[12px] text-slate-500 dark:text-slate-400">Applies to your next message</p>
        <span
          className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-[12px] dark:border-slate-700"
          style={{
            backgroundColor: previewUsesDarkSurface ? '#0F172A' : '#FFFFFF',
            fontFamily: value.fontFamily || DEFAULT_RICH_TEXT_FORMAT.fontFamily,
            color: value.color || DEFAULT_RICH_TEXT_FORMAT.color,
            fontWeight: value.bold ? 'bold' : 'normal',
            fontStyle: value.italic ? 'italic' : 'normal',
            textDecoration: value.underline ? 'underline' : 'none',
          }}
        >
          Aa
        </span>
      </div>
    </div>
  );
}
