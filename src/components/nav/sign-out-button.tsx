"use client";

import { useState, useTransition } from "react";
import { signOut } from "@/app/actions/auth";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function SignOutButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(() => {
      signOut();
    });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={className}>
        Sign out
      </button>
      <ConfirmDialog
        open={open}
        title="Sign out?"
        description="You'll need to sign in again to continue."
        confirmLabel="Sign out"
        pending={pending}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
