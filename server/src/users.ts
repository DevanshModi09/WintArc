// The fields of a user that other people are allowed to see.
export const publicUserSelect = { id: true, name: true, username: true, avatarUpdatedAt: true } as const;

type Selected = { id: string; name: string; username: string; avatarUpdatedAt: Date | null };

// The timestamp in the URL changes with every upload, so avatars can be cached forever.
export function avatarUrl(user: { id: string; avatarUpdatedAt: Date | null }) {
  return user.avatarUpdatedAt ? `/api/avatars/${user.id}?v=${user.avatarUpdatedAt.getTime()}` : null;
}

export function toPublicUser<T extends Selected>({ avatarUpdatedAt, ...rest }: T) {
  return { ...rest, avatarUrl: avatarUrl({ id: rest.id, avatarUpdatedAt }) };
}
