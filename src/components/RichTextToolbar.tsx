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
    `aim-toolbar-button focus:outline-none${active ? ' aim-toolbar-button-active' : ''}`;

  return (
    <div className="aim-glass-panel px-2 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="sr-only" htmlFor="rich-font-select">
          Font
        </label>
        <select
          id="rich-font-select"
          value={value.fontFamily}
          onChange={(event) => updateValue({ fontFamily: event.target.value })}
          className="aim-control aim-control-inline min-w-[150px]"
        >
          {AIM_FONT_OPTIONS.map((fontName) => (
            <option key={fontName} value={fontName}>
              {fontName}
            </option>
          ))}
        </select>

        <div className="ml-0.5 flex items-center gap-1 border-l border-slate-200 pl-2">
          <button type="button" aria-label="Bold" onClick={toggleWeight} className={toggleClassName(value.bold)}>
            B
          </button>
          <button type="button" aria-label="Italic" onClick={toggleItalic} className={toggleClassName(value.italic)}>
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
              className={`h-5 w-5 rounded-full border transition ${
                isActive
                  ? 'border-blue-500 shadow-[0_0_0_2px_rgba(191,219,254,0.9)]'
                  : 'border-slate-300 hover:scale-105'
              }`}
              style={{ backgroundColor: color.value }}
            />
          );
        })}
      </div>

      <p
        className="mt-2 truncate rounded-lg border border-slate-200 bg-slate-950 px-2 py-1.5 text-[11px]"
        style={{
          fontFamily: value.fontFamily || DEFAULT_RICH_TEXT_FORMAT.fontFamily,
          color: value.color || DEFAULT_RICH_TEXT_FORMAT.color,
          fontWeight: value.bold ? 'bold' : 'normal',
          fontStyle: value.italic ? 'italic' : 'normal',
          textDecoration: value.underline ? 'underline' : 'none',
        }}
      >
        Preview: message style
      </p>
    </div>
  );
}
