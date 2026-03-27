import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RICH_TEXT_FORMAT,
  formatRichText,
  getRichTextPresentation,
} from '@/lib/richText';

describe('richText', () => {
  it('does not force default inline styles onto plain messages', () => {
    expect(formatRichText('Hello there', DEFAULT_RICH_TEXT_FORMAT)).toBe('Hello there');
  });

  it('keeps custom styling when formatting is not default', () => {
    const html = formatRichText('Styled hello', {
      ...DEFAULT_RICH_TEXT_FORMAT,
      color: '#FF00FF',
      fontFamily: 'Comic Sans MS',
      bold: true,
    });

    expect(html).toContain("font-family: 'Comic Sans MS'");
    expect(html).toContain('color: #FF00FF');
    expect(html).toContain('font-weight: bold');
  });

  it('renders default-styled legacy html as plain readable bubble text', () => {
    const presentation = getRichTextPresentation(
      `<span style="font-family: 'Arial'; color: #000000">Plain legacy</span>`,
    );

    expect(presentation.hasCustomStyling).toBe(false);
    expect(presentation.html).toBe('Plain legacy');
  });
});
