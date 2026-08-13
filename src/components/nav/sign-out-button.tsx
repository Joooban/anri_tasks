"use client";

import { useTransition } from "react";
import { signOut } from "@/app/actions/auth";

export function SignOutButton({ className }: { className?: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm("Sign out?")) return;
    startTransition(() => {
      signOut();
    });
  }

  return (
    <button onClick={handleClick} disabled={pending} className={className}>
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
