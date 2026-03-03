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
    `inline-flex h-5 min-w-5 items-center justify-center border px-1 text-[11px] font-bold focus:outline-none ${
      active
        ? 'border-[#7f7f7f] border-t-[#a7a7a7] border-l-[#a7a7a7] border-r-white border-b-white bg-[#dfe6f1] text-[#1e395b]'
        : 'border-[#7f7f7f] border-t-white border-l-white border-r-[#808080] border-b-[#808080] bg-[#ece9d8] text-[#1e395b]'
    }`;

  return (
    <div className="border border-[#a9a9a9] border-t-white border-l-white border-r-[#8d8d8d] border-b-[#8d8d8d] bg-[#d4d0c8] px-1 py-1">
      <div className="flex flex-wrap items-center gap-1">
        <label className="sr-only" htmlFor="rich-font-select">
          Font
        </label>
        <select
          id="rich-font-select"
          value={value.fontFamily}
          onChange={(event) => updateValue({ fontFamily: event.target.value })}
          className="h-6 min-w-[130px] border border-[#7f7f7f] border-t-[#808080] border-l-[#808080] border-r-white border-b-white bg-white px-1 text-[11px] text-[#1e395b] focus:outline-none"
        >
          {AIM_FONT_OPTIONS.map((fontName) => (
            <option key={fontName} value={fontName}>
              {fontName}
            </option>
          ))}
        </select>

        <div className="ml-1 flex items-center gap-1 border-l border-[#b3b3b3] pl-1">
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

      <div className="mt-1 flex flex-wrap gap-1">
        {AIM_COLOR_OPTIONS.map((color) => {
          const isActive = value.color.toLowerCase() === color.value.toLowerCase();
          return (
            <button
              key={color.value}
              type="button"
              title={color.name}
              aria-label={color.name}
              onClick={() => updateValue({ color: color.value })}
              className={`h-3.5 w-3.5 border ${
                isActive
                  ? 'border-[#0b3f9c] shadow-[inset_0_0_0_1px_#ffffff]'
                  : 'border-[#7f7f7f] border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
              }`}
              style={{ backgroundColor: color.value }}
            />
          );
        })}
      </div>

      <p
        className="mt-1 truncate border border-[#5a5a5a] border-t-[#808080] border-l-[#808080] border-r-[#b6b6b6] border-b-[#b6b6b6] bg-[#0c0c0c] px-1 py-1 text-[11px]"
        style={{
          fontFamily: value.fontFamily || DEFAULT_RICH_TEXT_FORMAT.fontFamily,
          color: value.color || DEFAULT_RICH_TEXT_FORMAT.color,
          fontWeight: value.bold ? 'bold' : 'normal',
          fontStyle: value.italic ? 'italic' : 'normal',
          textDecoration: value.underline ? 'underline' : 'none',
        }}
      >
        Preview: Away message style
      </p>
    </div>
  );
}
