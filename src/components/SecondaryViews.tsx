import React, { useState } from 'react';
import {
  MapPin,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  QrCode,
  Search,
} from 'lucide-react';
import { DestinationPreset, ParkingFacility, Reservation } from '../types/parking';
import { AMENITY_LABELS, formatCurrency } from '../data/parkingData';

interface MonthlyPassesViewProps {
  facilities: ParkingFacility[];
  onReserveMonthly: (reservation: Reservation) => void;
  onGoToPasses: () => void;
}

export const MonthlyPassesView: React.FC<MonthlyPassesViewProps> = ({
  facilities,
  onReserveMonthly,
  onGoToPasses,
}) => {
  const [tier, setTier] = useState<'weekday' | 'unlimited'>('weekday');
  const [bookedFacilityName, setBookedFacilityName] = useState<string | null>(null);

  const handleBookMonthly = (fac: ParkingFacility) => {
    const now = new Date();
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const rate = tier === 'unlimited' ? fac.monthlyUnlimitedRate : fac.monthlyWeekdayRate;
    const codeNum = Math.floor(100000 + Math.random() * 899999);

    onReserveMonthly({
      id: `res-m-${Date.now()}`,
      currency: fac.currency,
      passCode: `CG-M${codeNum}`,
      facilityId: fac.id,
      facilityName: fac.name,
      facilityAddress: fac.address,
      facilityType: fac.facilityType,
      entryIso: now.toISOString(),
      exitIso: nextMonth.toISOString(),
      bayCode: 'M-RESERVED',
      bayLevel: 'P1',
      vehicleSize: 'sedan',
      licensePlate: 'TS 03 EK 4821',
      vehicleModel: 'Commuter Vehicle',
      driverName: 'Jordan Taylor',
      driverEmail: 'driver@curbgrid.app',
      subtotal: rate,
      serviceFee: 0,
      totalPaid: rate,
      status: 'monthly',
      createdAt: now.toISOString(),
      entryInstructions: fac.entryInstructions,
      isMonthly: true,
      monthlyTier: tier,
    });
    setBookedFacilityName(fac.name);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            Monthly Commuter Parking
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Lock in predictable monthly rates across Warangal, Hyderabad, Bengaluru, and metro transit hubs with zero long-term contracts.
          </p>
        </div>

        {/* Interactive Weekday vs 24/7 Unlimited Selector */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setTier('weekday')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              tier === 'weekday'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Weekday (Mon–Fri)
          </button>
          <button
            type="button"
            onClick={() => setTier('unlimited')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              tier === 'unlimited'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            24/7 Unlimited
          </button>
        </div>
      </div>

      {bookedFacilityName && (
        <div className="mt-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm text-emerald-950">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
            <span>
              Monthly pass activated for <strong>{bookedFacilityName}</strong> ({tier === 'unlimited' ? '24/7 Unlimited' : 'Weekday Commuter'}).
            </span>
          </div>
          <button
            type="button"
            onClick={onGoToPasses}
            className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            View Digital Pass
          </button>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {facilities.slice(0, 12).map((fac) => {
          const price = tier === 'unlimited' ? fac.monthlyUnlimitedRate : fac.monthlyWeekdayRate;
          return (
            <article
              key={fac.id}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
            >
              <img
                src={fac.imageUrl}
                alt={fac.name}
                referrerPolicy="no-referrer"
                className="w-full h-40 object-cover bg-slate-100"
              />
              <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-500">
                    {fac.district} · {fac.facilityType}
                  </div>
                  <h2 className="font-display text-base font-bold text-slate-900 mt-0.5">
                    {fac.name}
                  </h2>
                  <p className="text-xs text-slate-600 mt-1">{fac.address}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    {fac.amenities.slice(0, 3).map((a) => AMENITY_LABELS[a]).join(' · ')}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-mono text-xl font-bold text-slate-900 tabular-nums">
                      {formatCurrency(price, fac.currency, 0)}
                      <span className="text-xs font-sans font-normal text-slate-500">/mo</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {tier === 'unlimited' ? 'In & out 24/7' : 'Mon–Fri, 6AM–8PM'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleBookMonthly(fac)}
                    className="px-4 py-2 bg-slate-900 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Start Monthly Pass
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

interface VenuesAirportsViewProps {
  destinations: DestinationPreset[];
  onSelectDestination: (dest: DestinationPreset) => void;
}

export const VenuesAirportsView: React.FC<VenuesAirportsViewProps> = ({
  destinations,
  onSelectDestination,
}) => {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="pb-6 border-b border-slate-200">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
          Venues, Transit Hubs &amp; Airports
        </h1>
        <p className="text-sm text-slate-600 mt-1 max-w-2xl">
          Jump straight into guaranteed event-day lots, express terminal shuttles, and commuter rail decks near major destinations.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {destinations.map((dest) => (
          <article
            key={dest.id}
            className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-blue-400 transition-colors"
          >
            <div>
              <div className="text-xs font-medium text-blue-600">
                {dest.category} · Default {dest.defaultDurationHours}h window
              </div>
              <h2 className="font-display text-lg font-bold text-slate-900 mt-1">
                {dest.name}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {dest.subtitle}
              </p>
              <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                {dest.description}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onSelectDestination(dest)}
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-slate-900 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <span>View Nearby Spots</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </article>
        ))}
      </div>
    </div>
  );
};

interface HowItWorksViewProps {
  onStartSearching: () => void;
}

export const HowItWorksView: React.FC<HowItWorksViewProps> = ({ onStartSearching }) => {
  const steps = [
    {
      num: '01.',
      title: 'Compare Live Rates by Destination',
      body: 'Enter an address, landmark, or airport terminal along with your entry and exit window. Every price pin reflects your exact total stay including taxes and clearance fit.',
      icon: Search,
    },
    {
      num: '02.',
      title: 'Pick Your Exact Bay on Level P1 or P2',
      body: 'Inspect garage clearance, EV charger kilowatt ratings, and floor-level bay maps before paying. Reserve stalls near elevators or fast chargers in one click.',
      icon: QrCode,
    },
    {
      num: '03.',
      title: 'Scan QR or Drive Through Gate Cameras',
      body: 'Arrive at the facility and scan your digital pass at the barrier arm—no paper tickets required. Cancel free up to 1 hour before entry if plans shift.',
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-bold text-slate-900 text-balance">
          Predictable Urban Parking in Three Clear Steps
        </h1>
        <p className="text-base text-slate-600 mt-2 leading-relaxed">
          CurbGrid eliminates circling city blocks and surprise drive-up rates by locking in your exact bay and entry time before you leave.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div key={step.num} className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold text-blue-600">
                  {step.num}
                </span>
                <Icon className="w-5 h-5 text-slate-400" aria-hidden="true" />
              </div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                {step.title}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                {step.body}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-8">
        <button
          type="button"
          onClick={onStartSearching}
          className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
        >
          Search Open Parking Spots
        </button>
      </div>
    </div>
  );
};
