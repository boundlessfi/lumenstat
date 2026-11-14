'use server';

import { revalidatePath } from 'next/cache';
import { control } from '@/lib/server/control';
import { approve, reject } from '@/lib/server/enrollment';
import { requireOperator } from '@/lib/server/viewer';

export async function approveEnrollment(enrollmentId: string): Promise<void> {
  const viewer = await requireOperator();
  const enrollment = (await control.enrollments({ status: 'pending' })).find(e => e.enrollmentId === enrollmentId);
  if (enrollment) await approve(enrollment, viewer.user.username);
  revalidatePath('/ops/enrollment');
}

export async function rejectEnrollment(enrollmentId: string, form: FormData): Promise<void> {
  const viewer = await requireOperator();
  const note = String(form.get('note') ?? '').trim().slice(0, 300) || undefined;
  await reject(enrollmentId, viewer.user.username, note).catch(() => undefined);
  revalidatePath('/ops/enrollment');
}
