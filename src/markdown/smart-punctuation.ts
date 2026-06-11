export function replaceMarkdownProseSmartPunctuation(value: string): string {
  const lines = String(value).split('\n');
  let inCodeFence = false;
  let openQuote = true;

  return lines.map((line) => {
    if (line.startsWith('```')) {
      inCodeFence = !inCodeFence;
      return line;
    }
    if (inCodeFence) return line;

    let inInlineCode = false;
    let result = '';
    for (const character of line) {
      if (character === '`') {
        inInlineCode = !inInlineCode;
        result += character;
        continue;
      }
      if (!inInlineCode) {
        const replacement = replaceSmartPunctuationCharacter(character, openQuote);
        result += replacement.value;
        openQuote = replacement.openQuote;
      } else {
        result += character;
      }
    }
    return result;
  }).join('\n');
}

export function replaceStraightSmartPunctuation(value: string): string {
  let openQuote = true;
  let result = '';
  for (const character of String(value)) {
    const replacement = replaceSmartPunctuationCharacter(character, openQuote);
    result += replacement.value;
    openQuote = replacement.openQuote;
  }
  return result;
}

function replaceSmartPunctuationCharacter(character: string, openQuote: boolean): { openQuote: boolean; value: string } {
  if (character === '\'') {
    return { openQuote, value: '’' };
  }
  if (character === '"') {
    return {
      openQuote: !openQuote,
      value: openQuote ? '«' : '»'
    };
  }
  return { openQuote, value: character };
}
