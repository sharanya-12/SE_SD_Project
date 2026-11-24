import React, { useState } from 'react';
import {
  Clock,
  MapPin,
  Car,
  Plus,
  XCircle,
  Search,
  Printer,
} from 'lucide-react';
import { Reservation } from '../types/parking';
import { formatCurrency } from '../data/parkingData';
import { QrCodeSvg } from './QrCodeSvg';

interface MyPassesViewProps {
  reservations: Reservation[];
  onExtendReservation: (id: string) => void;
  onCancelReservation: (id: string) => void;
  onFindParking: () => void;
}

export const MyPassesView: React.FC<MyPassesViewProps> = ({
  reservations,
  onExtendReservation,
  onCancelReservation,
  onFindParking,
}) => {
  const [filterStatus, setFilterStatus] = useState<'active_upcoming' | 'all'>('active_upcoming');
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const visibleReservations = reservations.filter((r) =>
    filterStatus === 'active_upcoming' ? r.status !== 'cancelled' : true
  );

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            My Parking Passes
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Scan your QR pass at the garage barrier arm or drive straight through license plate recognition lanes.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setFilterStatus('active_upcoming')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              filterStatus === 'active_upcoming'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Active &amp; Upcoming
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All History
          </button>
        </div>
      </div>

      {visibleReservations.length === 0 ? (
        <div className="mt-10 bg-white border border-slate-200 rounded-xl p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
            <Search className="w-5 h-5" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">
            No active parking passes yet
          </h2>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Search nearby garages, compare hourly rates, and reserve an assigned stall to generate your instant QR gate pass.
          </p>
          <button
            type="button"
            onClick={onFindParking}
            className="mt-5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Find Parking Nearby
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {visibleReservations.map((res) => {
            const isCancelled = res.status === 'cancelled';
            return (
              <article
                key={res.id}
                className={`bg-white border rounded-xl overflow-hidden ${
                  isCancelled ? 'border-slate-200 opacity-75' : 'border-slate-200'
                }`}
              >
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-slate-900">
                        {res.passCode}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {res.isMonthly
                          ? `Monthly Pass (${res.monthlyTier === 'unlimited' ? '24/7 Unlimited' : 'Weekday Commuter'})`
                          : res.facilityType}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          isCancelled
                            ? 'text-red-700 font-semibold'
                            : 'text-emerald-700 font-semibold'
                        }
                      >
                        {isCancelled ? 'Cancelled' : 'Confirmed Gate Pass'}
                      </span>
                    </div>
                    <h2 className="font-display text-lg font-bold text-slate-900 mt-0.5">
                      {res.facilityName}
                    </h2>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                      {formatCurrency(res.totalPaid, res.currency || 'INR')}
                    </div>
                    <div className="text-xs font-mono text-blue-700 font-semibold">
                      {res.bayLevel} · Bay {res.bayCode}
                    </div>
                  </div>
                </div>

                <div className="p-5 flex flex-col md:flex-row items-start md:items-center gap-6">
                  {!isCancelled && <QrCodeSvg value={res.passCode} size={124} />}

                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm w-full">
                    <div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                        Entry Window
                      </div>
                      <div className="font-medium text-slate-900 mt-0.5 tabular-nums">
                        {formatTime(res.entryIso)}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                        Exit Before
                      </div>
                      <div className="font-medium text-slate-900 mt-0.5 tabular-nums">
                        {formatTime(res.exitIso)}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                        Facility Address
                      </div>
                      <div className="font-medium text-slate-900 mt-0.5">
                        {res.facilityAddress}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Car className="w-3.5 h-3.5" aria-hidden="true" />
                        Vehicle &amp; Plate
                      </div>
                      <div className="font-medium text-slate-900 mt-0.5">
                        {res.vehicleModel} · <span className="font-mono">{res.licensePlate}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-600 max-w-xl">
                    {res.entryInstructions}
                  </p>

                  {!isCancelled && (
                    <div className="flex flex-wrap items-center gap-2">
                      {!res.isMonthly && (
                        <button
                          type="button"
                          onClick={() => onExtendReservation(res.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                          Extend +1 hr
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                        Print Pass
                      </button>

                      {confirmCancelId === res.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              onCancelReservation(res.id);
                              setConfirmCancelId(null);
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
                          >
                            Confirm Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmCancelId(null)}
                            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            Keep
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmCancelId(res.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          Cancel Pass
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
