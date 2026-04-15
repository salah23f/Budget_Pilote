'use client';

import { Skeleton } from '@/components/ui/skeleton';

/* ------------------------------------------------------------------ */
/*  Dashboard Skeleton                                                  */
/* ------------------------------------------------------------------ */

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 fade-in">
      {/* Greeting */}
      <div className="space-y-2">
        <Skeleton variant="text" size="lg" width="60%" />
        <Skeleton variant="text" size="sm" width="35%" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface-card border border-border-subtle rounded-2xl p-4 space-y-3">
            <Skeleton variant="circle" size="md" />
            <Skeleton variant="text" size="md" width="70%" />
            <Skeleton variant="text" size="sm" width="50%" />
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-surface-card border border-border-subtle rounded-2xl p-5 space-y-2">
            <Skeleton variant="text" size="sm" width="40%" />
            <Skeleton variant="text" size="lg" width="60%" />
          </div>
        ))}
      </div>

      {/* Recent searches */}
      <div className="space-y-3">
        <Skeleton variant="text" size="md" width="30%" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-surface-card border border-border-subtle rounded-xl p-4 flex items-center gap-3">
            <Skeleton variant="circle" size="sm" />
            <div className="flex-1 space-y-1.5">
              <Skeleton variant="text" size="md" width="55%" />
              <Skeleton variant="text" size="sm" width="35%" />
            </div>
            <Skeleton variant="text" size="sm" width="60px" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Flights Skeleton                                                    */
/* ------------------------------------------------------------------ */

export function FlightsSkeleton() {
  return (
    <div className="space-y-6 fade-in">
      {/* Search form */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Skeleton variant="rect" size="sm" />
          <Skeleton variant="rect" size="sm" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Skeleton variant="rect" size="sm" />
          <Skeleton variant="rect" size="sm" />
          <Skeleton variant="rect" size="sm" />
        </div>
        <Skeleton variant="rect" size="sm" width="140px" />
      </div>

      {/* Results */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-surface-card border border-border-subtle rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Skeleton variant="circle" size="md" />
          <div className="flex-1 space-y-2 w-full">
            <Skeleton variant="text" size="md" width="65%" />
            <Skeleton variant="text" size="sm" width="40%" />
            <div className="flex gap-2 mt-1">
              <Skeleton variant="text" size="sm" width="60px" />
              <Skeleton variant="text" size="sm" width="80px" />
            </div>
          </div>
          <div className="text-right space-y-2">
            <Skeleton variant="text" size="lg" width="80px" />
            <Skeleton variant="text" size="sm" width="60px" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hotels Skeleton                                                     */
/* ------------------------------------------------------------------ */

export function HotelsSkeleton() {
  return (
    <div className="space-y-6 fade-in">
      {/* Search form */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 space-y-4">
        <Skeleton variant="rect" size="sm" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton variant="rect" size="sm" />
          <Skeleton variant="rect" size="sm" />
        </div>
        <Skeleton variant="rect" size="sm" width="140px" />
      </div>

      {/* Hotel cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden">
            <Skeleton variant="rect" size="lg" className="!rounded-none" />
            <div className="p-4 space-y-2">
              <Skeleton variant="text" size="md" width="70%" />
              <Skeleton variant="text" size="sm" width="50%" />
              <div className="flex gap-2">
                <Skeleton variant="text" size="sm" width="50px" />
                <Skeleton variant="text" size="sm" width="50px" />
                <Skeleton variant="text" size="sm" width="50px" />
              </div>
              <div className="flex justify-between items-center pt-2">
                <Skeleton variant="text" size="lg" width="80px" />
                <Skeleton variant="rect" size="sm" width="90px" height={36} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Bookings Skeleton                                                   */
/* ------------------------------------------------------------------ */

export function BookingsSkeleton() {
  return (
    <div className="space-y-4 fade-in">
      <Skeleton variant="text" size="lg" width="40%" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-surface-card border border-border-subtle rounded-2xl p-5 space-y-3">
          <div className="flex justify-between">
            <Skeleton variant="text" size="md" width="50%" />
            <Skeleton variant="text" size="sm" width="70px" />
          </div>
          <Skeleton variant="text" size="sm" width="65%" />
          <Skeleton variant="text" size="sm" width="40%" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Generic page skeleton                                               */
/* ------------------------------------------------------------------ */

export function PageSkeleton() {
  return (
    <div className="space-y-6 fade-in">
      <Skeleton variant="text" size="lg" width="50%" />
      <Skeleton variant="text" size="sm" width="70%" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    </div>
  );
}
