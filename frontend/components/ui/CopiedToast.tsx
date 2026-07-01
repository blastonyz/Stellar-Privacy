"use client";

type CopiedToastProps = {
  visible: boolean;
  message?: string;
};

export function CopiedToast({ visible, message = "Copied!" }: CopiedToastProps) {
  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-emerald-500/40 bg-emerald-950/95 px-4 py-2.5 text-sm font-medium text-emerald-100 shadow-lg shadow-emerald-950/50"
    >
      {message}
    </div>
  );
}
