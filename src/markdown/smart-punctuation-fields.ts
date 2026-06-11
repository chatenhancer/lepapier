import {
  replaceMarkdownProseSmartPunctuation,
  replaceStraightSmartPunctuation
} from './smart-punctuation';

export type SmartPunctuationFieldName = 'body' | 'description' | 'title';

export interface SmartPunctuationField {
  selectionEnd: number | null;
  selectionStart: number | null;
  setSelectionRange(start: number, end: number): void;
  value: string;
}

export interface NormalizeSmartPunctuationFieldsOptions {
  fieldNames?: SmartPunctuationFieldName[];
  getField(name: SmartPunctuationFieldName): SmartPunctuationField | undefined;
  onFirstChange?(): void;
}

export function isSmartPunctuationFieldName(fieldName: string): fieldName is SmartPunctuationFieldName {
  return fieldName === 'body' || fieldName === 'description' || fieldName === 'title';
}

export function normalizeSmartPunctuationValue(fieldName: SmartPunctuationFieldName, value: string): string {
  return fieldName === 'body'
    ? replaceMarkdownProseSmartPunctuation(value)
    : replaceStraightSmartPunctuation(value);
}

export function normalizeSmartPunctuationField(fieldName: string, field: SmartPunctuationField): boolean {
  if (!isSmartPunctuationFieldName(fieldName)) return false;

  const value = field.value;
  const normalized = normalizeSmartPunctuationValue(fieldName, value);
  if (normalized === value) return false;

  const selectionStart = field.selectionStart;
  const selectionEnd = field.selectionEnd;
  field.value = normalized;
  if (typeof selectionStart === 'number' && typeof selectionEnd === 'number') {
    field.setSelectionRange(selectionStart, selectionEnd);
  }
  return true;
}

export function normalizeSmartPunctuationFields({
  fieldNames = ['title', 'description', 'body'],
  getField,
  onFirstChange
}: NormalizeSmartPunctuationFieldsOptions): boolean {
  let changed = false;

  for (const fieldName of fieldNames) {
    const field = getField(fieldName);
    if (!field) continue;

    const value = field.value;
    const normalized = normalizeSmartPunctuationValue(fieldName, value);
    if (normalized === value) continue;

    if (!changed) {
      onFirstChange?.();
    }
    field.value = normalized;
    changed = true;
  }

  return changed;
}
