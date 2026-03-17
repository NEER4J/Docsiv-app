import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { APP_CONFIG } from '@/config/app-config';

export const metadata: Metadata = {
  title: `Document – ${APP_CONFIG.name}`,
};

export default async function DocumentEditorRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/d/${id}`);
}
