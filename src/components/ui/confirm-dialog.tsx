"use client";

import { startTransition, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  // Rendered through a portal straight onto <body> — a fixed-position
  // overlay nested inside the app's layout can end up "trapped" and offset
  // instead of centered on the real viewport if any ancestor sets a
  // transform/filter/will-change (creates a new containing block for
  // fixed descendants). A portal sidesteps that entirely.
  const [container, setContainer] = useState<HTMLElement | null>(null);
  // Separate flag so the entrance transition has a frame to animate from
  // (mounting already-visible would just snap in with no transition).
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    startTransition(() => setContainer(document.body));
  }, []);

  useEffect(() => {
    if (!open) return;
    startTransition(() => setMounted(true));
    const raf = requestAnimationFrame(() => setVisible(true));
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onCancel]);

  useEffect(() => {
    if (open) return;
    startTransition(() => setVisible(false));
    const timeout = setTimeout(() => setMounted(false), 150);
    return () => clearTimeout(timeout);
  }, [open]);

  if (!mounted || !container) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-opacity duration-150 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl transition-all duration-150 dark:border-zinc-800 dark:bg-zinc-900 ${
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0"
        }`}
      >
        {destructive && (
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-100 dark:bg-red-950">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600 dark:text-red-400">
              <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
          </div>
        )}
        <h2 id="confirm-dialog-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          {title}
        </h2>
        {description && <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className={
              destructive
                ? "rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                : "rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            }
          >
            {pending ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    container
  );
}
