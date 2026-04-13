'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

const CAR_TYPES = [
  { type: 'Economy', example: 'Toyota Yaris', pricePerDay: 25, icon: '🚗', seats: 4, bags: 2 },
  { type: 'Compact', example: 'VW Golf', pricePerDay: 35, icon: '🚙', seats: 5, bags: 3 },
  { type: 'Midsize', example: 'Toyota Camry', pricePerDay: 45, icon: '🚘', seats: 5, bags: 4 },
  { type: 'SUV', example: 'Toyota RAV4', pricePerDay: 65, icon: '🚜', seats: 5, bags: 5 },
  { type: 'Premium', example: 'BMW 3 Series', pricePerDay: 85, icon: '🏎️', seats: 5, bags: 4 },
  { type: 'Van', example: 'VW Transporter', pricePerDay: 75, icon: '🚐', seats: 9, bags: 8 },
];

const PROVIDERS = [
  { name: 'Europcar', color: '#00923F', url: 'https://www.europcar.com' },
  { name: 'Hertz', color: '#FFD100', url: 'https://www.hertz.com' },
  { name: 'Sixt', color: '#FF6600', url: 'https://www.sixt.com' },
  { name: 'Enterprise', color: '#007749', url: 'https://www.enterprise.com' },
];

export default function CarsPage() {
  const [location, setLocation] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [searched, setSearched] = useState(false);

  const days = pickupDate && returnDate
    ? Math.max(1, Math.ceil((new Date(returnDate).getTime() - new Date(pickupDate).getTime()) / 86400000))
    : 1;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (location && pickupDate && returnDate) setSearched(true);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
          <span>🚗</span> Car Rental
        </h1>
        <p className="text-sm text-white/40 mt-1">Compare prices from top rental companies</p>
      </div>

      <Card padding="lg">
        <form onSubmit={handleSearch}>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <Input label="Pick-up Location" placeholder="City or airport..." value={location} onChange={(e) => setLocation(e.target.value)} />
            <Input label="Pick-up Date" type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
            <Input label="Return Date" type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
            <Button type="submit" variant="primary" size="lg" fullWidth>Search Cars</Button>
          </div>
        </form>
      </Card>

      {searched && (
        <div className="space-y-4">
          <p className="text-sm text-white/50">
            <span className="text-white font-semibold">{CAR_TYPES.length}</span> car types · {days} day{days > 1 ? 's' : ''} · {location} · <span className="text-white/30">prices from</span>
          </p>

          {CAR_TYPES.map((car) => {
            const total = car.pricePerDay * days;
            return (
              <Card key={car.type} hoverable padding="md" className="card-interactive stagger-item">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="text-4xl">{car.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-white">{car.type}</span>
                      <span className="text-xs text-white/30">{car.example} or similar</span>
                    </div>
                    <div className="flex gap-3 text-xs text-white/40">
                      <span>👤 {car.seats} seats</span>
                      <span>🧳 {car.bags} bags</span>
                      <span>⚙️ Auto</span>
                      <span>❄️ A/C</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xl font-bold text-white">${total}</p>
                      <p className="text-[10px] text-white/30">${car.pricePerDay}/day</p>
                    </div>
                    <a
                      href={PROVIDERS[0].url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="primary" size="sm">Book</Button>
                    </a>
                  </div>
                </div>
                {/* Provider prices */}
                <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  {PROVIDERS.map((p, pi) => {
                    const seed = car.pricePerDay * (pi + 1) * 7;
                    const variance = Math.round(total * (0.92 + (seed % 15) / 100));
                    return (
                      <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-lg p-2 text-center hover:bg-white/3 transition" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                        <p className="text-[10px] text-white/40">{p.name}</p>
                        <p className="text-[10px] text-white/20">from</p>
                        <p className="text-xs font-semibold text-white">${variance}</p>
                      </a>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
