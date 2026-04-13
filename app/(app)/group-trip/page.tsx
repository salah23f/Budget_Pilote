'use client';

import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface Member {
  id: string;
  name: string;
  email: string;
  status: 'pending' | 'confirmed' | 'declined';
  budget: number;
}

interface Poll {
  id: string;
  question: string;
  options: { text: string; votes: number }[];
}

export default function GroupTripPage() {
  const [tripName, setTripName] = useState('');
  const [destination, setDestination] = useState('');
  const [dateRange, setDateRange] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [created, setCreated] = useState(false);

  const [polls, setPolls] = useState<Poll[]>([
    {
      id: '1',
      question: 'Which dates work best?',
      options: [
        { text: 'July 15-22', votes: 0 },
        { text: 'July 22-29', votes: 0 },
        { text: 'August 1-8', votes: 0 },
      ],
    },
    {
      id: '2',
      question: 'Preferred accommodation?',
      options: [
        { text: 'Hotel', votes: 0 },
        { text: 'Airbnb', votes: 0 },
        { text: 'Hostel', votes: 0 },
      ],
    },
  ]);

  const [expenses, setExpenses] = useState<{ description: string; amount: number; paidBy: string }[]>([]);
  const [newExpDesc, setNewExpDesc] = useState('');
  const [newExpAmount, setNewExpAmount] = useState('');

  const addMember = useCallback(() => {
    if (!newName.trim()) return;
    setMembers((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        name: newName.trim(),
        email: newEmail.trim(),
        status: 'pending',
        budget: 0,
      },
    ]);
    setNewName('');
    setNewEmail('');
  }, [newName, newEmail]);

  const vote = useCallback((pollId: string, optionIndex: number) => {
    setPolls((prev) =>
      prev.map((p) =>
        p.id === pollId
          ? {
              ...p,
              options: p.options.map((o, i) =>
                i === optionIndex ? { ...o, votes: o.votes + 1 } : o
              ),
            }
          : p
      )
    );
  }, []);

  const addExpense = useCallback(() => {
    if (!newExpDesc.trim() || !newExpAmount) return;
    setExpenses((prev) => [
      ...prev,
      { description: newExpDesc.trim(), amount: Number(newExpAmount), paidBy: 'You' },
    ]);
    setNewExpDesc('');
    setNewExpAmount('');
  }, [newExpDesc, newExpAmount]);

  const totalBudget = members.reduce((s, m) => s + m.budget, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  function handleCreate() {
    if (!tripName.trim()) return;
    setCreated(true);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
          <span>👥</span> Group Trip Planner
        </h1>
        <p className="text-sm text-white/40 mt-1">Invite friends, vote on plans, and split costs</p>
      </div>

      {!created ? (
        /* Creation form */
        <Card padding="lg" className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Create a new trip</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Trip Name" placeholder="Summer in Europe..." value={tripName} onChange={(e) => setTripName(e.target.value)} />
            <Input label="Destination" placeholder="Barcelona..." value={destination} onChange={(e) => setDestination(e.target.value)} />
            <Input label="Dates" type="date" value={dateRange} onChange={(e) => setDateRange(e.target.value)} />
          </div>
          <Button variant="primary" size="lg" onClick={handleCreate}>Create Trip</Button>
        </Card>
      ) : (
        <>
          {/* Trip header */}
          <Card padding="lg" className="glass-premium">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">{tripName}</h2>
                <p className="text-xs text-white/40">{destination} · {members.length + 1} travelers</p>
              </div>
              <button
                onClick={() => {
                  const link = `https://faregenie.vercel.app/group-trip?id=${Date.now()}`;
                  if (navigator.share) {
                    navigator.share({ title: tripName, text: `Join our trip to ${destination}!`, url: link });
                  } else {
                    navigator.clipboard.writeText(link);
                    alert('Invite link copied!');
                  }
                }}
                className="glass rounded-xl px-4 py-2 text-xs text-white/60 hover:text-white transition"
              >
                📤 Share Invite Link
              </button>
            </div>
          </Card>

          {/* Members */}
          <Card padding="md">
            <h3 className="text-sm font-semibold text-white mb-3">👥 Members</h3>
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'var(--flyeas-gradient)' }}>Y</div>
                <span className="text-sm text-white flex-1">You</span>
                <Badge variant="success" size="sm">Organizer</Badge>
              </div>
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-xl p-3 stagger-item" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white/50 bg-white/5">{m.name.charAt(0)}</div>
                  <div className="flex-1">
                    <span className="text-sm text-white">{m.name}</span>
                    {m.email && <span className="text-[10px] text-white/25 ml-2">{m.email}</span>}
                  </div>
                  <Badge variant={m.status === 'confirmed' ? 'success' : m.status === 'declined' ? 'danger' : 'default'} size="sm">
                    {m.status}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Input placeholder="Email (optional)" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              <Button variant="secondary" size="md" onClick={addMember}>Add</Button>
            </div>
          </Card>

          {/* Polls */}
          <Card padding="md">
            <h3 className="text-sm font-semibold text-white mb-3">📊 Polls</h3>
            <div className="space-y-4">
              {polls.map((poll) => {
                const totalVotes = poll.options.reduce((s, o) => s + o.votes, 0);
                return (
                  <div key={poll.id} className="space-y-2">
                    <p className="text-xs font-medium text-white/70">{poll.question}</p>
                    {poll.options.map((opt, oi) => {
                      const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                      return (
                        <button
                          key={oi}
                          onClick={() => vote(poll.id, oi)}
                          className="w-full flex items-center gap-3 rounded-lg p-2.5 text-left transition hover:bg-white/3"
                          style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                        >
                          <div className="flex-1 relative">
                            <div className="absolute inset-0 rounded-md" style={{ width: `${pct}%`, background: 'rgba(245,158,11,0.1)' }} />
                            <span className="relative text-xs text-white/70">{opt.text}</span>
                          </div>
                          <span className="text-[10px] text-white/30 min-w-[32px] text-right">{pct}%</span>
                          <span className="text-[10px] text-white/20">{opt.votes} votes</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Expense splitter */}
          <Card padding="md">
            <h3 className="text-sm font-semibold text-white mb-3">💰 Expenses</h3>
            <div className="space-y-2 mb-4">
              {expenses.length === 0 && (
                <p className="text-xs text-white/25 text-center py-3">No expenses yet</p>
              )}
              {expenses.map((exp, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div>
                    <span className="text-xs text-white">{exp.description}</span>
                    <span className="text-[10px] text-white/25 ml-2">paid by {exp.paidBy}</span>
                  </div>
                  <span className="text-sm font-semibold text-white">${exp.amount}</span>
                </div>
              ))}
              {expenses.length > 0 && (
                <div className="flex justify-between pt-2 text-xs" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-white/40">Total expenses</span>
                  <span className="font-bold text-amber-400">${totalExpenses}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Input placeholder="Description" value={newExpDesc} onChange={(e) => setNewExpDesc(e.target.value)} />
              <Input placeholder="Amount" type="number" value={newExpAmount} onChange={(e) => setNewExpAmount(e.target.value)} />
              <Button variant="secondary" size="md" onClick={addExpense}>Add</Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
