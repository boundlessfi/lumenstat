import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/server/viewer';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage() {
  if (await getViewer()) redirect('/');

  return (
    <div className="center-page">
      <LoginForm />
    </div>
  );
}
