import { redirect } from 'next/navigation';

/**
 * Legacy mission detail — superseded by the cockpit.
 * This page rendered data from the retired in-memory /api/mission
 * store; the cockpit is the single mission surface now.
 */
export default function MissionDetailRedirect({ params }: { params: { id: string } }) {
  redirect(`/missions/${params.id}/cockpit`);
}
