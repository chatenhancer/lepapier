export function getElement(node: EventTarget | Node | null): HTMLElement | null {
  if (node instanceof HTMLElement) return node;
  if (node instanceof Node) return node.parentElement;
  return null;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  const element = getElement(target);
  return Boolean(element?.closest('input, textarea, [contenteditable="true"]'));
}

export function nodeContains(root: Element, node: Node): boolean {
  const element = getElement(node);
  return Boolean(element && (element === root || root.contains(element)));
}
