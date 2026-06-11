import { describe, expect, it, vi } from 'vitest';
import {
  normalizeSmartPunctuationField,
  normalizeSmartPunctuationFields
} from './smart-punctuation-fields';

describe('smart punctuation fields', () => {
  it('normalizes one field and keeps the selection', () => {
    const field = {
      selectionEnd: 7,
      selectionStart: 1,
      setSelectionRange: vi.fn(),
      value: '"Hello"'
    };

    expect(normalizeSmartPunctuationField('title', field)).toBe(true);
    expect(field.value).toBe('«Hello»');
    expect(field.setSelectionRange).toHaveBeenCalledWith(1, 7);
  });

  it('normalizes all supported fields once', () => {
    const fields = {
      body: { selectionEnd: null, selectionStart: null, setSelectionRange: vi.fn(), value: '"Body" `\"code\"`' },
      description: { selectionEnd: null, selectionStart: null, setSelectionRange: vi.fn(), value: '"Description"' },
      title: { selectionEnd: null, selectionStart: null, setSelectionRange: vi.fn(), value: '"Title"' }
    };
    const onFirstChange = vi.fn();

    expect(normalizeSmartPunctuationFields({
      getField: (name) => fields[name],
      onFirstChange
    })).toBe(true);

    expect(fields.title.value).toBe('«Title»');
    expect(fields.description.value).toBe('«Description»');
    expect(fields.body.value).toBe('«Body» `"code"`');
    expect(onFirstChange).toHaveBeenCalledTimes(1);
  });
});
