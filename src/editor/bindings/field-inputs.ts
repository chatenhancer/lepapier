import { slugify } from '../../shared/text';
import type {
  EditorFieldElement,
  EditorFieldName
} from './elements';

export interface EditorFieldInputOptions {
  fields: Map<EditorFieldName, EditorFieldElement>;
  fieldElements: EditorFieldElement[];
  isSlugEdited(): boolean;
  markFieldEdited(fieldName: EditorFieldName): void;
  normalizeField(field: EditorFieldElement, fieldName: EditorFieldName): void;
  recordHistory(): void;
  resizeBodyInput(): void;
  scheduleMetadata(): void;
  setFieldValue(name: EditorFieldName, value: string): void;
  sync(): void;
}

export function bindEditorFieldInputs({
  fields,
  fieldElements,
  isSlugEdited,
  markFieldEdited,
  normalizeField,
  recordHistory,
  resizeBodyInput,
  scheduleMetadata,
  setFieldValue,
  sync
}: EditorFieldInputOptions): void {
  for (const field of fieldElements) {
    const fieldName = field.dataset.field as EditorFieldName | undefined;
    if (!fieldName) continue;
    fields.set(fieldName, field);
    field.addEventListener('beforeinput', () => {
      recordHistory();
    });
    field.addEventListener('input', () => {
      normalizeField(field, fieldName);
      if (fieldName === 'body') {
        resizeBodyInput();
      }
      if (fieldName === 'title' && !isSlugEdited()) {
        setFieldValue('slug', slugify(field.value));
      }
      markFieldEdited(fieldName);
      sync();
      scheduleMetadata();
    });
  }
}
