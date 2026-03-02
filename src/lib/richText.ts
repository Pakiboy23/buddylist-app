export interface RichTextFormat {
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

export interface RichColorOption {
  name: string;
  value: string;
}

export const AIM_FONT_OPTIONS = [
  'Arial',
  'Comic Sans MS',
  'Times New Roman',
  'Courier New',
  'Trebuchet MS',
] as const;

export const AIM_COLOR_OPTIONS: ReadonlyArray<RichColorOption> = [
  { name: 'Black', value: '#000000' },
  { name: 'White', value: '#FFFFFF' },
  { name: 'Neon Green', value: '#00FF00' },
  { name: 'Hot Pink', value: '#FF00FF' },
  { name: 'AIM Blue', value: '#0000FF' },
  { name: 'Red', value: '#FF0000' },
  { name: 'Purple', value: '#8000FF' },
  { name: 'Orange', value: '#FF7A00' },
  { name: 'Yellow', value: '#FFD400' },
  { name: 'Cyan', value: '#00FFFF' },
  { name: 'Lime', value: '#7CFC00' },
  { name: 'Maroon', value: '#800000' },
  { name: 'Navy', value: '#000080' },
  { name: 'Teal', value: '#008080' },
  { name: 'Gray', value: '#808080' },
  { name: 'Silver', value: '#C0C0C0' },
];

export const DEFAULT_RICH_TEXT_FORMAT: RichTextFormat = {
  fontFamily: 'Arial',
  color: '#000000',
  bold: false,
  italic: false,
  underline: false,
};

const ALLOWED_TAGS = new Set(['SPAN', 'B', 'I', 'U', 'BR']);
const ALLOWED_STYLE_PROPERTIES = new Set([
  'font-family',
  'color',
  'font-weight',
  'font-style',
  'text-decoration',
]);
const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const ALLOWED_FONT_SET = new Set<string>(AIM_FONT_OPTIONS.map((font) => font.toLowerCase()));
const ALLOWED_COLOR_SET = new Set<string>(AIM_COLOR_OPTIONS.map((color) => color.value.toLowerCase()));

function escapeHtml(raw: string) {
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeFontFamily(fontFamily: string | null | undefined): string {
  if (!fontFamily) {
    return DEFAULT_RICH_TEXT_FORMAT.fontFamily;
  }

  const normalized = fontFamily.replaceAll(/['"]/g, '').trim();
  if (!normalized) {
    return DEFAULT_RICH_TEXT_FORMAT.fontFamily;
  }

  const matched = AIM_FONT_OPTIONS.find(
    (option) => option.toLowerCase() === normalized.toLowerCase(),
  );
  return matched ?? DEFAULT_RICH_TEXT_FORMAT.fontFamily;
}

function normalizeColor(color: string | null | undefined): string {
  if (!color) {
    return DEFAULT_RICH_TEXT_FORMAT.color;
  }

  const normalized = color.trim();
  if (!normalized) {
    return DEFAULT_RICH_TEXT_FORMAT.color;
  }

  if (ALLOWED_COLOR_SET.has(normalized.toLowerCase())) {
    return normalized.toUpperCase();
  }

  if (HEX_COLOR_REGEX.test(normalized)) {
    return normalized.length === 4
      ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`.toUpperCase()
      : normalized.toUpperCase();
  }

  return DEFAULT_RICH_TEXT_FORMAT.color;
}

function sanitizeInlineStyle(styleValue: string): string {
  const declarations = styleValue
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);

  const normalized: string[] = [];

  for (const declaration of declarations) {
    const [rawProperty, ...valueParts] = declaration.split(':');
    if (!rawProperty || valueParts.length === 0) {
      continue;
    }

    const property = rawProperty.trim().toLowerCase();
    const value = valueParts.join(':').trim();

    if (!ALLOWED_STYLE_PROPERTIES.has(property) || !value) {
      continue;
    }

    if (property === 'font-family') {
      const safeFont = normalizeFontFamily(value);
      normalized.push(`font-family: '${safeFont}'`);
      continue;
    }

    if (property === 'color') {
      const safeColor = normalizeColor(value);
      normalized.push(`color: ${safeColor}`);
      continue;
    }

    if (property === 'font-weight') {
      const lowered = value.toLowerCase();
      if (lowered === 'bold' || lowered === 'normal' || lowered === '700' || lowered === '400') {
        normalized.push(`font-weight: ${lowered === '700' ? 'bold' : lowered === '400' ? 'normal' : lowered}`);
      }
      continue;
    }

    if (property === 'font-style') {
      const lowered = value.toLowerCase();
      if (lowered === 'italic' || lowered === 'normal') {
        normalized.push(`font-style: ${lowered}`);
      }
      continue;
    }

    if (property === 'text-decoration') {
      const lowered = value.toLowerCase();
      if (lowered === 'underline' || lowered === 'none') {
        normalized.push(`text-decoration: ${lowered}`);
      }
    }
  }

  return normalized.join('; ');
}

function basicSanitizeFallback(rawHtml: string): string {
  return rawHtml
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\sstyle\s*=\s*(['"])\s*.*?javascript:.*?\1/gi, '');
}

export function sanitizeRichTextHtml(rawHtml: string | null | undefined): string {
  if (!rawHtml) {
    return '';
  }

  const input = String(rawHtml);
  if (typeof window === 'undefined') {
    return basicSanitizeFallback(input);
  }

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(input, 'text/html');

  documentNode
    .querySelectorAll('script, style, iframe, object, embed, link, meta')
    .forEach((element) => element.remove());

  const walker = documentNode.createTreeWalker(documentNode.body, NodeFilter.SHOW_ELEMENT);
  const allElements: Element[] = [];

  while (walker.nextNode()) {
    allElements.push(walker.currentNode as Element);
  }

  for (const element of allElements) {
    if (!ALLOWED_TAGS.has(element.tagName)) {
      const textNode = documentNode.createTextNode(element.textContent ?? '');
      element.replaceWith(textNode);
      continue;
    }

    const attributes = [...element.attributes];
    for (const attribute of attributes) {
      const name = attribute.name.toLowerCase();
      if (element.tagName === 'SPAN' && name === 'style') {
        const safeStyle = sanitizeInlineStyle(attribute.value);
        if (safeStyle) {
          element.setAttribute('style', safeStyle);
        } else {
          element.removeAttribute('style');
        }
        continue;
      }
      element.removeAttribute(attribute.name);
    }
  }

  return documentNode.body.innerHTML;
}

export function formatRichText(rawText: string, format: RichTextFormat): string {
  const safeFont = normalizeFontFamily(format.fontFamily);
  const safeColor = normalizeColor(format.color);
  const escapedText = escapeHtml(rawText).replace(/\n/g, '<br />');

  const styleParts = [`font-family: '${safeFont}'`, `color: ${safeColor}`];
  if (format.bold) {
    styleParts.push('font-weight: bold');
  }
  if (format.italic) {
    styleParts.push('font-style: italic');
  }
  if (format.underline) {
    styleParts.push('text-decoration: underline');
  }

  return `<span style="${styleParts.join('; ')}">${escapedText || '&nbsp;'}</span>`;
}

export function htmlToPlainText(rawHtml: string | null | undefined): string {
  if (!rawHtml) {
    return '';
  }

  const sanitized = sanitizeRichTextHtml(rawHtml).replace(/<br\s*\/?>/gi, '\n');
  if (typeof window === 'undefined') {
    return sanitized.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
  }

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(sanitized, 'text/html');
  return (documentNode.body.textContent ?? '').replace(/\u00a0/g, ' ');
}

export function detectRichTextFormat(rawHtml: string | null | undefined): RichTextFormat {
  if (!rawHtml) {
    return { ...DEFAULT_RICH_TEXT_FORMAT };
  }

  const sanitized = sanitizeRichTextHtml(rawHtml);
  if (!sanitized) {
    return { ...DEFAULT_RICH_TEXT_FORMAT };
  }

  let styleValue = '';

  if (typeof window === 'undefined') {
    const styleMatch = sanitized.match(/style\s*=\s*(['"])(.*?)\1/i);
    styleValue = styleMatch?.[2] ?? '';
  } else {
    const parser = new DOMParser();
    const documentNode = parser.parseFromString(sanitized, 'text/html');
    const firstSpan = documentNode.querySelector('span[style]');
    styleValue = firstSpan?.getAttribute('style') ?? '';
  }

  const safeStyle = sanitizeInlineStyle(styleValue);
  if (!safeStyle) {
    return { ...DEFAULT_RICH_TEXT_FORMAT };
  }

  const nextFormat: RichTextFormat = { ...DEFAULT_RICH_TEXT_FORMAT };
  const declarations = safeStyle
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);

  for (const declaration of declarations) {
    const [rawProperty, ...valueParts] = declaration.split(':');
    if (!rawProperty || valueParts.length === 0) {
      continue;
    }

    const property = rawProperty.trim().toLowerCase();
    const value = valueParts.join(':').trim().replaceAll(/['"]/g, '');

    if (property === 'font-family') {
      const normalizedFont = normalizeFontFamily(value);
      if (ALLOWED_FONT_SET.has(normalizedFont.toLowerCase())) {
        nextFormat.fontFamily = normalizedFont;
      }
      continue;
    }

    if (property === 'color') {
      const normalizedColor = normalizeColor(value);
      if (ALLOWED_COLOR_SET.has(normalizedColor.toLowerCase()) || HEX_COLOR_REGEX.test(normalizedColor)) {
        nextFormat.color = normalizedColor;
      }
      continue;
    }

    if (property === 'font-weight') {
      nextFormat.bold = value.toLowerCase() === 'bold';
      continue;
    }

    if (property === 'font-style') {
      nextFormat.italic = value.toLowerCase() === 'italic';
      continue;
    }

    if (property === 'text-decoration') {
      nextFormat.underline = value.toLowerCase() === 'underline';
    }
  }

  return nextFormat;
}
