'use client';

import { createContext, ReactNode, useContext } from 'react';
import {
  LiveblocksProvider,
  RoomProvider,
  useOthers,
  useUpdateMyPresence,
} from '@liveblocks/react';
import { useCallback } from 'react';

const LiveblocksEnabledContext = createContext(false);

const COLORS = ['#e03131', '#2f9e44', '#1971c2', '#f08c00', '#9c36b5'];

function PresenceAvatars() {
  const others = useOthers();
  if (others.length === 0) return null;
  return (
    <div className="flex items-center gap-1 shrink-0">
      <span className="font-body text-xs text-muted-foreground">
        {others.length} viewing
      </span>
      <div className="flex -space-x-2">
        {others.slice(0, 5).map((user, i) => (
          <div
            key={user.id}
            className="size-6 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-medium text-white"
            style={{ backgroundColor: COLORS[i % COLORS.length], zIndex: 5 - i }}
            title={user.info?.name ?? 'User'}
          >
            {(user.info?.name ?? user.id ?? '?').charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  );
}

function PresenceUpdater({ children }: { children: ReactNode }) {
  const updatePresence = useUpdateMyPresence();
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      updatePresence({ cursor: { x: e.clientX, y: e.clientY } });
    },
    [updatePresence]
  );
  const handlePointerLeave = useCallback(() => {
    updatePresence({ cursor: null });
  }, [updatePresence]);

  return (
    <div
      className="contents"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {children}
    </div>
  );
}

export function DocumentRoomProvider({
  documentId,
  children,
  enabled = true,
}: {
  documentId: string;
  children: ReactNode;
  /** When false, children render without Liveblocks (no presence). Use when LIVEBLOCKS_SECRET_KEY is not set. */
  enabled?: boolean;
}) {
  const roomId = `document:${documentId}`;

  if (!enabled) {
    return (
      <LiveblocksEnabledContext.Provider value={false}>
        {children}
      </LiveblocksEnabledContext.Provider>
    );
  }

  return (
    <LiveblocksEnabledContext.Provider value={true}>
      <LiveblocksProvider authEndpoint="/api/liveblocks-auth">
        <RoomProvider
          id={roomId}
          initialPresence={{ cursor: null }}
        >
          <PresenceUpdater>
            {children}
          </PresenceUpdater>
        </RoomProvider>
      </LiveblocksProvider>
    </LiveblocksEnabledContext.Provider>
  );
}

export function DocumentPresenceAvatars() {
  const enabled = useContext(LiveblocksEnabledContext);
  if (!enabled) return null;
  return <PresenceAvatars />;
}
