import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type UserLike = {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

/**
 * Initials from a name, falling back to the email local part.
 *
 * Splits on whitespace, dots, underscores, hyphens and `@` so both
 * "Suresh Kumar" and "sureshkumar@loanwiser.in" produce something sensible.
 */
export function initialsOf(user: UserLike): string {
  const source = user.name?.trim() || user.email?.split("@")[0] || "";
  const parts = source.split(/[\s._-]+/).filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();

  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

/** Display label: real name if we have one, otherwise the email. */
export function displayName(user: UserLike): string {
  return user.name?.trim() || user.email || "Unknown";
}

const SIZES = {
  xs: "size-6 text-[10px]",
  sm: "size-7 text-[11px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
} as const;

export function UserAvatar({
  user,
  size = "sm",
  className,
}: {
  user: UserLike;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <Avatar className={cn(SIZES[size], "shrink-0", className)}>
      {user.image ? <AvatarImage src={user.image} alt="" /> : null}
      {/* The label is on the wrapper, so the fallback text is not announced twice. */}
      <AvatarFallback className="bg-secondary text-secondary-foreground font-medium">
        {initialsOf(user)}
      </AvatarFallback>
    </Avatar>
  );
}

/** Avatar + name + email, the shape used in every member/assignee list. */
export function UserCell({
  user,
  size = "md",
  suffix,
}: {
  user: UserLike;
  size?: keyof typeof SIZES;
  suffix?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <UserAvatar user={user} size={size} />
      <div className="min-w-0">
        <p className="flex items-center gap-2 truncate text-sm font-medium">
          {displayName(user)}
          {suffix}
        </p>
        {user.email && user.name && (
          <p className="text-muted-foreground truncate font-mono text-xs">
            {user.email}
          </p>
        )}
      </div>
    </div>
  );
}

/** Overlapping avatar row for members on a card. */
export function AvatarStack({
  users,
  max = 4,
}: {
  users: UserLike[];
  max?: number;
}) {
  const shown = users.slice(0, max);
  const overflow = users.length - shown.length;

  return (
    <div className="flex items-center">
      {shown.map((user, index) => (
        <UserAvatar
          key={user.id ?? user.email ?? index}
          user={user}
          size="xs"
          className="ring-card -ml-1.5 ring-2 first:ml-0"
        />
      ))}
      {overflow > 0 && (
        <span className="bg-secondary text-muted-foreground ring-card -ml-1.5 flex size-6 items-center justify-center rounded-full text-[10px] font-medium ring-2">
          +{overflow}
        </span>
      )}
    </div>
  );
}
