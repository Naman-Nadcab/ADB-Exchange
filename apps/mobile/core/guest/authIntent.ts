type AuthResumeAction = () => void;

let pendingResume: AuthResumeAction | null = null;

export function setPendingAuthResume(action: AuthResumeAction | null): void {
  pendingResume = action;
}

export function consumePendingAuthResume(): void {
  const action = pendingResume;
  pendingResume = null;
  action?.();
}

export function clearPendingAuthResume(): void {
  pendingResume = null;
}

export function hasPendingAuthResume(): boolean {
  return pendingResume != null;
}
