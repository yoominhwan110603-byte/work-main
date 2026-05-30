type CaptureKind = 'image' | 'video';

type PendingCapture = {
  kind: CaptureKind;
  dataUrl: string;
};

let pendingCapture: PendingCapture | null = null;
let pendingSellDraft: Record<string, unknown> | null = null;

export function setPendingCapture(kind: CaptureKind, dataUrl: string) {
  pendingCapture = { kind, dataUrl };
}

export function takePendingCapture(kind: CaptureKind) {
  if (!pendingCapture || pendingCapture.kind !== kind) return '';
  const dataUrl = pendingCapture.dataUrl;
  pendingCapture = null;
  return dataUrl;
}

export function setPendingSellDraft(draft: Record<string, unknown>) {
  pendingSellDraft = draft;
}

export function takePendingSellDraft() {
  const draft = pendingSellDraft;
  pendingSellDraft = null;
  return draft;
}
