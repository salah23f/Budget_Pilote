'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface GroupTrip {
  id: string;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  owner_name: string;
  invite_code: string;
  created_at: string;
}

export default function GroupTripPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<GroupTrip[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Get user info
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('sv_user');
      if (stored) {
        const user = JSON.parse(stored);
        setUserName(user.firstName || '');
        setUserEmail(user.email || '');
      }
    } catch {}
  }, []);

  // Load user's trips
  useEffect(() => {
    if (!userEmail) return;
    fetch(`/api/group-trips?email=${encodeURIComponent(userEmail)}`)
      .then((r) => r.json())
      .then((data) => { if (data.success) setTrips(data.trips || []); })
      .catch(() => {});
  }, [userEmail]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);

    try {
      const res = await fetch('/api/group-trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          destination: destination.trim(),
          startDate,
          endDate,
          ownerName: userName || 'Organizer',
          ownerEmail: userEmail,
        }),
      });
      const data = await res.json();
      if (data.success && data.trip) {
        router.push(`/group-trip/${data.trip.id}`);
      } else {
        alert(data.error || 'Failed to create trip');
      }
    } catch (err: any) {
      alert(err.message || 'Network error');
    }
    setCreating(false);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.12)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="7" r="4" /><circle cx="17" cy="10" r="3" />
              <path d="M2 21c0-4 3-7 7-7s7 3 7 7" /><path d="M15 21c0-3 2-5 5-5" />
            </svg>
          </div>
          Group Trip Planner
        </h1>
        <p className="text-sm text-white/40 mt-1">Plan trips together — invite friends, vote on plans, split costs</p>
      </div>

      {/* Create new trip */}
      <Card padding="lg">
        <h2 className="text-base font-semibold text-white mb-4">Create a new trip</h2>
        <form onSubmit={handleCreate}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <Input label="Trip Name" placeholder="Summer in Barcelona..." value={name} onChange={(e) => setName(e.target.value)} required />
            <Input label="Destination" placeholder="City or country..." value={destination} onChange={(e) => setDestination(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <Button type="submit" variant="primary" size="lg" fullWidth disabled={creating || !name.trim()}>
            {creating ? 'Creating...' : 'Create Trip'}
          </Button>
        </form>
      </Card>

      {/* My trips */}
      {trips.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-white">Your Trips</h2>
          {trips.map((trip) => (
            <Card
              key={trip.id}
              hoverable
              padding="md"
              className="cursor-pointer card-interactive"
              onClick={() => router.push(`/group-trip/${trip.id}`)}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.08)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{trip.name}</p>
                  <p className="text-xs text-white/40">
                    {trip.destination || 'No destination set'}
                    {trip.start_date && ` · ${new Date(trip.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant="default" size="sm">
                    {trip.owner_name === userName ? 'Organizer' : 'Member'}
                  </Badge>
                  <p className="text-[10px] text-white/20 mt-1">
                    {new Date(trip.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Join via code */}
      <Card padding="md" className="text-center">
        <p className="text-xs text-white/40 mb-2">Have an invite link? It will open directly to the trip page.</p>
        <p className="text-[10px] text-white/20">Format: faregenie.vercel.app/group-trip/[id]?code=xxxxxxxx</p>
      </Card>
    </div>
  );
}
