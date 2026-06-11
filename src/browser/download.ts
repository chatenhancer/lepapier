export function downloadBlob(fileName: string, blob: Blob, {
  documentTarget = document,
  windowTarget = window
}: {
  documentTarget?: Document;
  windowTarget?: Window;
} = {}): void {
  const url = URL.createObjectURL(blob);
  const link = documentTarget.createElement('a');
  link.href = url;
  link.download = fileName;
  documentTarget.body.append(link);
  link.click();
  link.remove();
  windowTarget.setTimeout(() => URL.revokeObjectURL(url), 0);
}
