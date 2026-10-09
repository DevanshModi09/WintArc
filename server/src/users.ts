// The fields of a user that other people are allowed to see.
export const publicUserSelect = { id: true, name: true, username: true, avatarUpdatedAt: true } as const;

// What a profile page shows on top of that.
export const profileSelect = {
  ...publicUserSelect,
  bio: true,
  stack: true,
  location: true,
  link: true,
  createdAt: true,
} as const;

type Selected = { id: string; name: string; username: string; avatarUpdatedAt: Date | null };

// The timestamp in the URL changes with every upload, so avatars can be cached forever.
export function avatarUrl(user: { id: string; avatarUpdatedAt: Date | null }) {
  return user.avatarUpdatedAt ? `/api/avatars/${user.id}?v=${user.avatarUpdatedAt.getTime()}` : null;
}

export function toPublicUser<T extends Selected>({ avatarUpdatedAt, ...rest }: T) {
  return { ...rest, avatarUrl: avatarUrl({ id: rest.id, avatarUpdatedAt }) };
}
