import React, { useState } from 'react';
import {
  MapPin,
  Star,
  AlertTriangle,
  Car,
  RotateCcw,
} from 'lucide-react';
import { DestinationPreset, ParkingFacility, VehicleSize } from '../types/parking';
import {
  AMENITY_LABELS,
  calculateFacilityPrice,
  formatCurrency,
  formatDurationLabel,
  getDistanceMiles,
  isVehicleCompatible,
} from '../data/parkingData';

interface FacilityListProps {
  facilities: ParkingFacility[];
  destination: DestinationPreset;
  durationHours: number;
  vehicleSize: VehicleSize;
  selectedFacilityId: string | null;
  hoveredFacilityId: string | null;
  onSelectFacility: (facility: ParkingFacility) => void;
  onHoverFacility: (facilityId: string | null) => void;
  onInspectFacility: (facility: ParkingFacility) => void;
  onResetFilters: () => void;
}

const FacilityThumb: React.FC<{ src: string; alt: string; label: string }> = ({
  src,
  alt,
  label,
}) => {
  const [errored, setErrored] = useState(false);

  if (errored || !src) {
    return (
      <div className="w-24 h-20 sm:w-28 sm:h-22 rounded-lg bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400 shrink-0 px-2 text-center">
        <Car className="w-5 h-5 mb-1" aria-hidden="true" />
        <span className="text-[10px] font-medium leading-tight text-slate-500 truncate w-full">
          {label}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setErrored(true)}
      className="w-24 h-20 sm:w-28 sm:h-22 object-cover rounded-lg border border-slate-200 shrink-0 bg-slate-100"
    />
  );
};

export const FacilityList: React.FC<FacilityListProps> = ({
  facilities,
  destination,
  durationHours,
  vehicleSize,
  selectedFacilityId,
  hoveredFacilityId,
  onSelectFacility,
  onHoverFacility,
  onInspectFacility,
  onResetFilters,
}) => {
  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Results Header */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50/70">
        <div className="min-w-0">
          <h1 className="font-display text-base font-semibold text-slate-900 truncate">
            {facilities.length} parking {facilities.length === 1 ? 'facility' : 'facilities'} in {destination.cityLabel}
          </h1>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            Near {destination.name} · {formatDurationLabel(durationHours)} stay
          </p>
        </div>
      </div>

      {/* Scrollable Results */}
      <div className="flex-1 overflow-y-auto curb-scroll divide-y divide-slate-200">
        {facilities.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-11 h-11 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
              <MapPin className="w-5 h-5" aria-hidden="true" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900">
              No parking spots match these filters
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
              Try clearing your amenity filter or search query to see all open garages and lots in {destination.cityLabel}.
            </p>
            <button
              type="button"
              onClick={onResetFilters}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Reset Filters
            </button>
          </div>
        ) : (
          facilities.map((fac) => {
            const { total, effectiveHourly } = calculateFacilityPrice(
              fac,
              durationHours,
              vehicleSize
            );
            const { miles, km, walkMinutes } = getDistanceMiles(fac, destination);
            const distLabel = fac.currency === 'INR' ? `${km.toFixed(1)} km` : `${miles.toFixed(2)} mi`;
            const compatible = isVehicleCompatible(fac, vehicleSize);
            const isSelected = selectedFacilityId === fac.id;
            const isHovered = hoveredFacilityId === fac.id;

            const amenityText = fac.amenities
              .slice(0, 3)
              .map((a) => AMENITY_LABELS[a])
              .join(' · ');

            return (
              <article
                key={fac.id}
                onMouseEnter={() => onHoverFacility(fac.id)}
                onMouseLeave={() => onHoverFacility(null)}
                onClick={() => onSelectFacility(fac)}
                className={`p-4 sm:px-5 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/70'
                    : isHovered
                    ? 'bg-slate-50'
                    : 'bg-white hover:bg-slate-50/70'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <FacilityThumb
                    src={fac.imageUrl}
                    alt={`${fac.name} parking entrance`}
                    label={fac.facilityType}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-slate-900 leading-snug truncate">
                          {fac.name}
                        </h2>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {fac.address} · {fac.district}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono text-lg font-bold text-slate-900 tabular-nums leading-none">
                          {formatCurrency(total, fac.currency, 0)}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 tabular-nums mt-1">
                          {formatCurrency(effectiveHourly, fac.currency)}/hr
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                      <span className="font-medium text-slate-800 tabular-nums">
                        {walkMinutes} min walk ({distLabel})
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" aria-hidden="true" />
                        {fac.rating.toFixed(1)} ({fac.reviewCount})
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Max {fac.clearanceLabel}</span>
                    </div>

                    <p className="mt-1 text-xs text-slate-500 truncate">
                      {fac.facilityType} · {amenityText}
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      {!compatible ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
                          Clearance {fac.clearanceLabel} (too low for van)
                        </span>
                      ) : fac.availableSpots <= 3 ? (
                        <span className="text-xs font-semibold text-amber-700 tabular-nums">
                          Only {fac.availableSpots} {fac.availableSpots === 1 ? 'bay' : 'bays'} left
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-emerald-700 tabular-nums">
                          {fac.availableSpots} bays open now
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspectFacility(fac);
                        }}
                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-slate-900 text-white hover:bg-slate-800'
                        }`}
                      >
                        Select Bay
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
};
