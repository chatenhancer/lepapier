type MarkdownInput = HTMLInputElement | HTMLTextAreaElement;

export function replaceSelection(input: MarkdownInput, text: string): void {
  const { start, end } = getSelectionRange(input);
  const before = input.value.slice(0, start);
  const after = input.value.slice(end);
  const prefix = before && !before.endsWith('\n') && needsBlockPadding(text) ? '\n\n' : '';
  const suffix = after && !after.startsWith('\n') && needsBlockPadding(text) ? '\n\n' : '';
  input.value = `${before}${prefix}${text}${suffix}${after}`;
  const cursor = before.length + prefix.length + text.length;
  input.focus();
  input.setSelectionRange(cursor, cursor);
}

export function getSelectionRange(input: MarkdownInput): { end: number; start: number } {
  return {
    end: input.selectionEnd || 0,
    start: input.selectionStart || 0
  };
}

function needsBlockPadding(text: string): boolean {
  return /^(#{1,6}\s|> |- |\`\`\`)/.test(text);
}
