'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  AvatarGroup,
  AvatarGroupCount,
} from '@/components/ui/avatar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export type DocumentPresenceUser = {
  userId: string;
  userName: string;
  userEmail: string | null;
  avatarUrl: string | null;
  cursor: { x: number; y: number } | null;
};

export type DocumentPresenceCurrentUser = {
  userId: string;
  userName: string;
  userEmail: string | null;
  avatarUrl: string | null;
};

type DocumentRoomContextValue = {
  enabled: boolean;
  currentUser: DocumentPresenceCurrentUser | null;
  others: DocumentPresenceUser[];
  updatePresence: (cursor: { x: number; y: number } | null) => void;
};

const DocumentRoomContext = createContext<DocumentRoomContextValue>({
  enabled: false,
  currentUser: null,
  others: [],
  updatePresence: () => {},
});

const CURSOR_THROTTLE_MS = 50;

/** Returns everyone in the channel (including self) so we show all viewers. */
function parsePresenceState(
  state: Record<string, Array<Record<string, unknown>>>
): DocumentPresenceUser[] {
  const list: DocumentPresenceUser[] = [];
  for (const key of Object.keys(state)) {
    const arr = state[key];
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const first = arr[0] as Record<string, unknown>;
    const userId = (first.userId as string) ?? key.split('-')[0] ?? key;
    const userName = (first.userName as string) ?? 'User';
    const userEmail = (first.userEmail as string) ?? null;
    const avatarUrl = (first.avatarUrl as string) ?? null;
    const cursor = first.cursor as { x: number; y: number } | null | undefined;
    list.push({
      userId,
      userName,
      userEmail: typeof userEmail === 'string' ? userEmail : null,
      avatarUrl: typeof avatarUrl === 'string' ? avatarUrl : null,
      cursor: cursor && typeof cursor.x === 'number' && typeof cursor.y === 'number' ? cursor : null,
    });
  }
  return list;
}

function PresenceUpdater({ children }: { children: ReactNode }) {
  const { enabled, updatePresence } = useContext(DocumentRoomContext);
  const lastSent = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const pending = useRef<{ x: number; y: number } | null>(null);

  const flush = useCallback(() => {
    if (pending.current) {
      updatePresence(pending.current);
      pending.current = null;
    }
    rafRef.current = null;
  }, [updatePresence]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      const now = Date.now();
      if (now - lastSent.current < CURSOR_THROTTLE_MS) {
        pending.current = { x: e.clientX, y: e.clientY };
        if (rafRef.current == null) {
          rafRef.current = requestAnimationFrame(flush);
        }
        return;
      }
      lastSent.current = now;
      updatePresence({ x: e.clientX, y: e.clientY });
    },
    [enabled, updatePresence, flush]
  );

  const handlePointerLeave = useCallback(() => {
    if (!enabled) return;
    updatePresence(null);
    pending.current = null;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, [enabled, updatePresence]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="contents" onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave}>
      {children}
    </div>
  );
}

export function DocumentRoomProvider({
  documentId,
  currentUserId,
  currentUserDisplay,
  children,
  enabled = true,
}: {
  documentId: string;
  currentUserId?: string;
  currentUserDisplay?: { name?: string; email?: string | null; avatarUrl?: string | null };
  children: ReactNode;
  enabled?: boolean;
}) {
  const [others, setOthers] = useState<DocumentPresenceUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentUserIdRef = useRef(currentUserId ?? '');
  const userNameRef = useRef(currentUserDisplay?.name ?? 'User');
  const userEmailRef = useRef<string | null>(currentUserDisplay?.email ?? null);
  const avatarUrlRef = useRef<string | null>(currentUserDisplay?.avatarUrl ?? null);

  useEffect(() => {
    currentUserIdRef.current = currentUserId ?? '';
    userNameRef.current = currentUserDisplay?.name ?? 'User';
    userEmailRef.current = currentUserDisplay?.email ?? null;
    avatarUrlRef.current = currentUserDisplay?.avatarUrl ?? null;
  }, [currentUserId, currentUserDisplay?.name, currentUserDisplay?.email, currentUserDisplay?.avatarUrl]);

  const updatePresence = useCallback(
    (cursor: { x: number; y: number } | null) => {
      const ch = channelRef.current;
      if (!ch) return;
      const userId = currentUserIdRef.current;
      const userName = userNameRef.current;
      const userEmail = userEmailRef.current;
      const avatarUrl = avatarUrlRef.current;
      ch.track({
        userId,
        userName: userName || 'User',
        userEmail: userEmail ?? null,
        avatarUrl: avatarUrl ?? null,
        cursor,
      });
    },
    []
  );

  const currentUser: DocumentPresenceCurrentUser | null =
    enabled && documentId
      ? {
          userId: currentUserId ?? '',
          userName: currentUserDisplay?.name ?? (currentUserId ? 'You' : 'Anonymous'),
          userEmail: currentUserDisplay?.email ?? null,
          avatarUrl: currentUserDisplay?.avatarUrl ?? null,
        }
      : null;

  useEffect(() => {
    if (!enabled || !documentId) return;
    currentUserIdRef.current = currentUserId ?? '';
    userNameRef.current = currentUserDisplay?.name ?? 'User';
    userEmailRef.current = currentUserDisplay?.email ?? null;
    avatarUrlRef.current = currentUserDisplay?.avatarUrl ?? null;

    const supabase = createClient();
    const channelName = `document:${documentId}`;
    const userId = currentUserIdRef.current;
    // Unique key per connection so multiple tabs/windows of same user all appear; anon-xxx for not-logged-in
    const presenceKey = `${userId || 'anon'}-${Math.random().toString(36).slice(2, 11)}`;

    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: presenceKey },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setOthers(parsePresenceState(state as Record<string, Array<Record<string, unknown>>>));
      })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;
        const uid = currentUserIdRef.current;
        const name = userNameRef.current;
        const userEmail = userEmailRef.current;
        const avatarUrl = avatarUrlRef.current;
        await channel.track({
          userId: uid,
          userName: name || 'User',
          userEmail: userEmail ?? null,
          avatarUrl: avatarUrl ?? null,
          cursor: null,
        });
      });

    channelRef.current = channel;

    return () => {
      channel.untrack().then(() => supabase.removeChannel(channel));
      channelRef.current = null;
      setOthers([]);
    };
  }, [enabled, documentId, currentUserId]);

  const value: DocumentRoomContextValue = {
    enabled,
    currentUser,
    others,
    updatePresence,
  };

  return (
    <DocumentRoomContext.Provider value={value}>
      <PresenceUpdater>{children}</PresenceUpdater>
    </DocumentRoomContext.Provider>
  );
}

export function DocumentPresenceCursors() {
  return null;
}

function isAnonymous(userId: string): boolean {
  return !userId || userId.startsWith('anon-');
}

type PresenceAvatarUser = {
  userId: string;
  userName: string;
  userEmail: string | null;
  avatarUrl: string | null;
};

const VISIBLE_AVATARS = 5;

/** Bright colors for anonymous avatar fallbacks (full background, white text). */
const ANON_AVATAR_COLORS = [
  '#e03131', // red
  '#2f9e44', // green
  '#1971c2', // blue
  '#f08c00', // orange
  '#9c36b5', // purple
  '#0ca678', // teal
  '#e67700', // amber
  '#c92a2a', // dark red
];

function DocumentPresenceAvatarStack({ users }: { users: PresenceAvatarUser[] }) {
  const visible = users.slice(0, VISIBLE_AVATARS);
  const overflow = users.length - VISIBLE_AVATARS;

  return (
    <AvatarGroup className="flex shrink-0" data-size="sm">
      {visible.map((user, index) => {
        const anon = isAnonymous(user.userId);
        const displayName = anon ? 'Anonymous' : (user.userName || 'User');
        const initial = displayName.charAt(0).toUpperCase();
        const anonColor = anon ? ANON_AVATAR_COLORS[index % ANON_AVATAR_COLORS.length] : undefined;
        // Stable key: anon users share userId prefix, use index so each connection shows
        const key = user.userId ? `${user.userId}-${index}` : `anon-${index}`;
        return (
          <Popover key={key}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex shrink-0 outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 rounded-full cursor-pointer"
                aria-label={displayName}
              >
                <Avatar size="sm" className="shrink-0 ring-2 ring-background">
                  <AvatarImage src={user.avatarUrl ?? undefined} alt={displayName} />
                  <AvatarFallback
                    className={anonColor ? 'text-white font-medium' : undefined}
                    style={anonColor ? { backgroundColor: anonColor } : undefined}
                  >
                    {initial}
                  </AvatarFallback>
                </Avatar>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3 min-w-[180px]" align="end" sideOffset={6}>
              <p className="font-medium text-sm">{displayName}</p>
              {!anon && user.userEmail && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate" title={user.userEmail}>
                  {user.userEmail}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Viewing this document</p>
            </PopoverContent>
          </Popover>
        );
      })}
      {overflow > 0 && (
        <AvatarGroupCount className="shrink-0 text-xs">
          +{overflow}
        </AvatarGroupCount>
      )}
    </AvatarGroup>
  );
}

export function DocumentPresenceAvatars() {
  const { enabled, currentUser, others } = useContext(DocumentRoomContext);
  // others now includes everyone in the channel (including this connection); enrich current user with profile
  const allUsers: PresenceAvatarUser[] = others.map((o) =>
    currentUser && o.userId === currentUser.userId
      ? { ...o, userName: currentUser.userName, userEmail: currentUser.userEmail, avatarUrl: currentUser.avatarUrl }
      : o
  );
  if (!enabled || allUsers.length === 0) return null;
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="font-body text-xs text-muted-foreground whitespace-nowrap">
        {allUsers.length} viewing
      </span>
      <DocumentPresenceAvatarStack users={allUsers} />
    </div>
  );
}
