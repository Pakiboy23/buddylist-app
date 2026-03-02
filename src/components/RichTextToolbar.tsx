'use client';

import {
  AIM_COLOR_OPTIONS,
  AIM_FONT_OPTIONS,
  DEFAULT_RICH_TEXT_FORMAT,
  RichTextFormat,
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

  const toggleWeight = () => updateValue({ bold: !value.bold });
  const toggleItalic = () => updateValue({ italic: !value.italic });
  const toggleUnderline = () => updateValue({ underline: !value.underline });

  const toggleClassName = (active: boolean) =>
    `inline-flex h-6 min-w-6 items-center justify-center rounded-sm border px-1 text-[11px] font-semibold transition-colors focus:outline-none ${
      active
        ? 'border-blue-400 bg-blue-200 text-blue-800'
        : 'border-transparent bg-transparent text-slate-700 hover:border-blue-300 hover:bg-blue-100'
    }`;

  return (
    <div className="rounded-md border border-blue-200 bg-blue-50/50 px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="rich-font-select">
          Font
        </label>
        <select
          id="rich-font-select"
          value={value.fontFamily}
          onChange={(event) => updateValue({ fontFamily: event.target.value })}
          className="h-7 min-w-[155px] rounded-sm border border-blue-300 bg-white px-2 text-[11px] text-slate-700 focus:border-blue-400 focus:outline-none"
        >
          {AIM_FONT_OPTIONS.map((fontName) => (
            <option key={fontName} value={fontName}>
              {fontName}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 border-l border-blue-200 pl-2">
          <button
            type="button"
            aria-label="Bold"
            onClick={toggleWeight}
            className={toggleClassName(value.bold)}
          >
            B
          </button>
          <button
            type="button"
            aria-label="Italic"
            onClick={toggleItalic}
            className={toggleClassName(value.italic)}
          >
            I
          </button>
          <button
            type="button"
            aria-label="Underline"
            onClick={toggleUnderline}
            className={toggleClassName(value.underline)}
          >
            U
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {AIM_COLOR_OPTIONS.map((color) => {
          const isActive = value.color.toLowerCase() === color.value.toLowerCase();
          return (
            <button
              key={color.value}
              type="button"
              title={color.name}
              aria-label={color.name}
              onClick={() => updateValue({ color: color.value })}
              className={`h-3.5 w-3.5 rounded-sm border transition-all ${
                isActive
                  ? 'border-blue-500 ring-1 ring-blue-400'
                  : 'border-blue-200 hover:border-blue-300 hover:scale-105'
              }`}
              style={{ backgroundColor: color.value }}
            />
          );
        })}
      </div>

      <p
        className="mt-2 truncate rounded-sm border border-blue-200 bg-white px-2 py-1 text-[11px] text-slate-600"
        style={{
          fontFamily: value.fontFamily || DEFAULT_RICH_TEXT_FORMAT.fontFamily,
          color: value.color || DEFAULT_RICH_TEXT_FORMAT.color,
          fontWeight: value.bold ? 'bold' : 'normal',
          fontStyle: value.italic ? 'italic' : 'normal',
          textDecoration: value.underline ? 'underline' : 'none',
        }}
      >
        Preview: AIM 5.5 Style
      </p>
    </div>
  );
}
