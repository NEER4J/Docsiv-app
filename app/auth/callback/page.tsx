import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AuthCallback({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const params = await searchParams

  const code = Array.isArray(params.code) ? params.code[0] : params.code
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next
  const next = typeof rawNext === 'string' && rawNext.startsWith('/') ? rawNext : '/dashboard/documents'

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      const loginUrl = next !== '/dashboard/documents'
        ? `/auth/login?error=callback_error&next=${encodeURIComponent(next)}`
        : '/auth/login?error=callback_error'
      redirect(loginUrl)
    }
  } else {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      const loginUrl = next !== '/dashboard/documents'
        ? `/auth/login?error=no_code&next=${encodeURIComponent(next)}`
        : '/auth/login?error=no_code'
      redirect(loginUrl)
    }
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    const loginUrl = next !== '/dashboard/documents'
      ? `/auth/login?error=session_missing&next=${encodeURIComponent(next)}`
      : '/auth/login?error=session_missing'
    redirect(loginUrl)
  }

  redirect(next)
}
