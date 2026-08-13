interface PersonLike {
  full_name: string | null;
  email: string;
  department?: { name: string } | null;
}

export function personDisplayName(person: PersonLike | null | undefined): string {
  if (!person) return "Unknown";
  return person.full_name || person.email;
}

// "Name · Department" — the department tag makes it obvious at a glance
// which office a comment/approval/audit entry came from, without having to
// already know who everyone is.
export function PersonLabel({ person }: { person: PersonLike | null | undefined }) {
  if (!person) return <span>Unknown</span>;
  return (
    <span>
      {personDisplayName(person)}
      {person.department && (
        <span className="text-zinc-400 dark:text-zinc-500"> · {person.department.name}</span>
      )}
    </span>
  );
}
