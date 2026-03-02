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
    `h-6 min-w-6 border-2 px-1 text-[11px] font-bold ${
      active
        ? 'border-[#0a0a0a] border-b-white border-r-white bg-[#d4def0] text-os-blue'
        : 'border-white border-b-[#0a0a0a] border-r-[#0a0a0a] bg-os-grey text-black'
    }`;

  return (
    <div className="border border-os-dark-grey bg-[#d5d9e6] p-1 shadow-window-in">
      <div className="flex flex-wrap items-center gap-1">
        <label className="sr-only" htmlFor="rich-font-select">
          Font
        </label>
        <select
          id="rich-font-select"
          value={value.fontFamily}
          onChange={(event) => updateValue({ fontFamily: event.target.value })}
          className="h-6 min-w-[140px] border-2 border-[#0a0a0a] border-b-white border-r-white bg-white px-1 text-[11px] focus:outline-none"
        >
          {AIM_FONT_OPTIONS.map((fontName) => (
            <option key={fontName} value={fontName}>
              {fontName}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 border-l border-os-dark-grey pl-1">
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

      <div className="mt-1 grid grid-cols-8 gap-[3px]">
        {AIM_COLOR_OPTIONS.map((color) => {
          const isActive = value.color.toLowerCase() === color.value.toLowerCase();
          return (
            <button
              key={color.value}
              type="button"
              title={color.name}
              aria-label={color.name}
              onClick={() => updateValue({ color: color.value })}
              className={`h-4 w-4 border ${
                isActive ? 'border-black ring-1 ring-black' : 'border-os-dark-grey'
              }`}
              style={{ backgroundColor: color.value }}
            />
          );
        })}
      </div>

      <p
        className="mt-1 truncate border border-[#9aa3bb] bg-white px-1 py-[2px] text-[11px]"
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
