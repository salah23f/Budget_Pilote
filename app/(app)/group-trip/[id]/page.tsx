'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface Member { id: string; user_name: string; user_email: string; role: string; status: string; }
interface PollOption { id: string; text: string; votes: number; }
interface Poll { id: string; question: string; options: PollOption[]; }
interface Expense { id: string; description: string; amount: number; paid_by: string; created_at: string; }
interface Trip { id: string; name: string; destination: string; start_date: string; end_date: string; owner_name: string; invite_code: string; }

export default function GroupTripDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tripId = params.id as string;
  const inviteCode = searchParams.get('code');

  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User info
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [joined, setJoined] = useState(false);

  // Forms
  const [inviteEmail, setInviteEmail] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [showExpense, setShowExpense] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('sv_user');
      if (stored) {
        const user = JSON.parse(stored);
        setUserName(user.firstName || '');
        setUserEmail(user.email || '');
      }
    } catch (_) {}
  }, []);

  const loadTrip = useCallback(async () => {
    try {
      const res = await fetch(`/api/group-trips/${tripId}`);
      const data = await res.json();
      if (data.success) {
        setTrip(data.trip);
        setMembers(data.members || []);
        setPolls(data.polls || []);
        setExpenses(data.expenses || []);
        // Check if user is already a member
        if (userEmail && data.members?.some((m: Member) => m.user_email === userEmail.toLowerCase())) {
          setJoined(true);
        }
      } else {
        setError(data.error || 'Trip not found');
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }, [tripId, userEmail]);

  useEffect(() => { loadTrip(); }, [loadTrip]);

  // Auto-join if invite code present
  useEffect(() => {
    if (!inviteCode || !trip || joined) return;
    fetch(`/api/group-trips/${tripId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: inviteCode, userName: userName || 'Guest', userEmail }),
    })
      .then((r) => r.json())
      .then((data) => { if (data.success) { setJoined(true); loadTrip(); } })
      .catch(() => {});
  }, [inviteCode, trip, joined, tripId, userName, userEmail, loadTrip]);

  async function handleInvite() {
    if (!inviteEmail.includes('@')) return;
    await fetch(`/api/group-trips/${tripId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, inviterName: userName }),
    });
    setInviteEmail('');
    setShowInvite(false);
    loadTrip();
  }

  async function handleCreatePoll() {
    const validOptions = pollOptions.filter((o) => o.trim());
    if (!pollQuestion.trim() || validOptions.length < 2) return;
    await fetch(`/api/group-trips/${tripId}/polls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: pollQuestion, options: validOptions }),
    });
    setPollQuestion('');
    setPollOptions(['', '']);
    setShowPoll(false);
    loadTrip();
  }

  async function handleVote(pollId: string, optionId: string) {
    await fetch(`/api/group-trips/${tripId}/polls/${pollId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionId }),
    });
    loadTrip();
  }

  async function handleAddExpense() {
    if (!expDesc.trim() || !expAmount) return;
    await fetch(`/api/group-trips/${tripId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: expDesc, amount: Number(expAmount), paidBy: userName || 'Unknown' }),
    });
    setExpDesc('');
    setExpAmount('');
    setShowExpense(false);
    loadTrip();
  }

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const perPerson = members.length > 0 ? Math.round(totalExpenses / members.length * 100) / 100 : 0;

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-white/40">Loading trip...</p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <Card padding="lg">
          <h2 className="text-xl font-bold text-white mb-2">Trip not found</h2>
          <p className="text-sm text-white/40">{error || 'This trip may have been deleted or the link is invalid.'}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8 space-y-6">
      {/* Trip header */}
      <Card padding="lg" className="glass-premium">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">{trip.name}</h1>
            <p className="text-sm text-white/40 mt-1">
              {trip.destination || 'No destination set'}
              {trip.start_date && ` · ${new Date(trip.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
            </p>
            <p className="text-xs text-white/25 mt-1">Organized by {trip.owner_name}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const link = `https://faregenie.vercel.app/group-trip/${trip.id}?code=${trip.invite_code}`;
                if (navigator.share) {
                  navigator.share({ title: trip.name, text: `Join our trip to ${trip.destination}!`, url: link });
                } else {
                  navigator.clipboard.writeText(link);
                  alert('Invite link copied!');
                }
              }}
              className="glass rounded-xl px-4 py-2 text-xs text-white/60 hover:text-white transition flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>
              Share Link
            </button>
            <button onClick={() => setShowInvite(!showInvite)} className="glass rounded-xl px-4 py-2 text-xs text-white/60 hover:text-white transition">
              + Invite
            </button>
          </div>
        </div>

        {showInvite && (
          <div className="flex gap-2 mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Input placeholder="friend@email.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            <Button variant="primary" size="md" onClick={handleInvite}>Send Invite</Button>
          </div>
        )}
      </Card>

      {/* Members */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="4"/><path d="M2 21c0-4 3-7 7-7s7 3 7 7"/><circle cx="17" cy="10" r="3"/><path d="M15 21c0-3 2-5 5-5"/></svg>
            Members ({members.length})
          </h2>
        </div>
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: m.role === 'organizer' ? 'var(--flyeas-gradient)' : 'rgba(255,255,255,0.05)', color: m.role === 'organizer' ? 'white' : 'rgba(255,255,255,0.4)' }}>
                {m.user_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <span className="text-sm text-white">{m.user_name}</span>
                {m.user_email && <span className="text-[10px] text-white/20 ml-2">{m.user_email}</span>}
              </div>
              <Badge variant={m.status === 'confirmed' ? 'success' : 'warning'} size="sm">
                {m.role === 'organizer' ? 'Organizer' : m.status}
              </Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Polls */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8A317" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><rect x="7" y="10" width="3" height="8"/><rect x="14" y="6" width="3" height="12"/></svg>
            Polls ({polls.length})
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setShowPoll(!showPoll)}>+ New Poll</Button>
        </div>

        {showPoll && (
          <div className="space-y-3 p-4 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Input placeholder="What should we vote on?" value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} />
            {pollOptions.map((opt, i) => (
              <Input key={i} placeholder={`Option ${i + 1}`} value={opt} onChange={(e) => {
                const updated = [...pollOptions];
                updated[i] = e.target.value;
                setPollOptions(updated);
              }} />
            ))}
            <div className="flex gap-2">
              <button onClick={() => setPollOptions([...pollOptions, ''])} className="text-xs text-amber-400/60 hover:text-amber-300 transition">+ Add option</button>
              <div className="flex-1" />
              <Button variant="primary" size="sm" onClick={handleCreatePoll}>Create Poll</Button>
            </div>
          </div>
        )}

        {polls.length === 0 && !showPoll && (
          <p className="text-xs text-white/25 text-center py-4">No polls yet. Create one to vote on dates, destinations, or activities.</p>
        )}

        {polls.map((poll) => {
          const totalVotes = poll.options.reduce((s, o) => s + o.votes, 0);
          return (
            <div key={poll.id} className="mb-4 last:mb-0">
              <p className="text-xs font-medium text-white/70 mb-2">{poll.question}</p>
              <div className="space-y-1.5">
                {poll.options.map((opt) => {
                  const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleVote(poll.id, opt.id)}
                      className="w-full flex items-center gap-3 rounded-lg p-3 text-left transition hover:bg-white/3 relative overflow-hidden"
                      style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div className="absolute inset-0 rounded-lg" style={{ width: `${pct}%`, background: 'rgba(245,158,11,0.08)' }} />
                      <span className="relative flex-1 text-xs text-white/70">{opt.text}</span>
                      <span className="relative text-[10px] text-white/30 min-w-[40px] text-right">{pct}% ({opt.votes})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Card>

      {/* Expenses */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M15 9.5c-.8-1-2-1.5-3-1.5s-2.5.7-2.5 2c0 2.5 5 1.5 5 4 0 1.3-1.2 2-2.5 2s-2.2-.5-3-1.5"/></svg>
            Expenses
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setShowExpense(!showExpense)}>+ Add</Button>
        </div>

        {showExpense && (
          <div className="flex gap-2 mb-4 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Input placeholder="Description" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} />
            <Input placeholder="$" type="number" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} className="max-w-[100px]" />
            <Button variant="primary" size="md" onClick={handleAddExpense}>Add</Button>
          </div>
        )}

        {expenses.length === 0 && !showExpense && (
          <p className="text-xs text-white/25 text-center py-4">No expenses yet. Track shared costs here.</p>
        )}

        <div className="space-y-2">
          {expenses.map((exp) => (
            <div key={exp.id} className="flex items-center justify-between rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div>
                <span className="text-xs text-white">{exp.description}</span>
                <span className="text-[10px] text-white/20 ml-2">by {exp.paid_by}</span>
              </div>
              <span className="text-sm font-semibold text-white">${Number(exp.amount).toFixed(2)}</span>
            </div>
          ))}
        </div>

        {expenses.length > 0 && (
          <div className="mt-4 pt-3 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex justify-between text-xs">
              <span className="text-white/40">Total expenses</span>
              <span className="font-bold text-white">${totalExpenses.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/40">Per person ({members.length} members)</span>
              <span className="font-semibold text-amber-400">${perPerson.toFixed(2)}</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
