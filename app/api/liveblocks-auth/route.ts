import { Liveblocks } from '@liveblocks/node';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

function getLiveblocks() {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret?.startsWith('sk_')) return null;
  return new Liveblocks({ secret });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    });
  }

  const body = await request.json().catch(() => ({}));
  const roomId = body.room as string | undefined;

  // Validate access: workspace member OR document collaborator
  if (roomId && roomId.startsWith('document:')) {
    const documentId = roomId.replace('document:', '');
    const { data: doc } = await supabase
      .from('documents')
      .select('workspace_id')
      .eq('id', documentId)
      .single();
    if (doc?.workspace_id) {
      // Check workspace membership
      const { data: member } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', doc.workspace_id)
        .eq('user_id', user.id)
        .single();

      if (!member) {
        // Fallback: check document collaborator access
        const { data: collab } = await supabase
          .from('document_collaborators')
          .select('id, role')
          .eq('document_id', documentId)
          .or(`user_id.eq.${user.id},email.eq.${user.email}`)
          .single();

        if (!collab) {
          return new NextResponse(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
          });
        }
      }
    }
  }

  const liveblocks = getLiveblocks();
  if (!liveblocks) {
    return new NextResponse(JSON.stringify({ error: 'Liveblocks not configured' }), {
      status: 503,
    });
  }

  const { status, body: tokenBody } = await liveblocks.identifyUser(
    {
      userId: user.id,
      groupIds: [],
    },
    {
      userInfo: {
        name: user.user_metadata?.full_name ?? user.email ?? 'User',
        avatar: user.user_metadata?.avatar_url ?? undefined,
      },
    }
  );

  return new NextResponse(tokenBody, { status });
}
