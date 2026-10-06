import type { Metadata } from 'next';
import { auth } from '@/auth';
import AcceptInvitationForm from './accept-invitation-form';

export const metadata: Metadata = {
  title: 'Chấp nhận lời mời — NexaTicket',
};

export default async function AcceptInvitationPage() {
  const session = await auth();

  return (
    <AcceptInvitationForm
      authenticated={Boolean(session)}
      email={session?.user?.email ?? null}
    />
  );
}