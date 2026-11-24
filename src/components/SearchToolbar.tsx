import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Search,
  MapPin,
  Clock,
  Car,
  SlidersHorizontal,
  X,
  ArrowUpDown,
  PlusCircle,
} from 'lucide-react';
import {
  AmenityType,
  DestinationPreset,
  ParkingFacility,
  SearchState,
  SortOption,
  VehicleSize,
} from '../types/parking';
import {
  DESTINATION_PRESETS,
  VEHICLE_LABELS,
  formatCurrency,
  formatDurationLabel,
  getDurationHours,
} from '../data/parkingData';

interface SearchToolbarProps {
  search: SearchState;
  activeDestination: DestinationPreset;
  facilities: ParkingFacility[];
  onChangeSearch: (patch: Partial<SearchState>) => void;
  onSelectDestination: (dest: DestinationPreset) => void;
  onSelectCustomLocation: (locationName: string) => void;
  onSelectGarageFromSearch: (facility: ParkingFacility) => void;
}

const FILTER_OPTIONS: Array<{ id: 'all' | AmenityType; label: string }> = [
  { id: 'all', label: 'All Spots' },
  { id: 'covered', label: 'Covered' },
  { id: 'ev_charging', label: 'EV Charging' },
  { id: 'valet', label: 'Valet' },
  { id: 'access_24_7', label: '24/7 Access' },
  { id: 'self_park', label: 'Self-Park' },
  { id: 'in_out', label: 'In & Out' },
];

export const SearchToolbar: React.FC<SearchToolbarProps> = ({
  search,
  activeDestination,
  facilities,
  onChangeSearch,
  onSelectDestination,
  onSelectCustomLocation,
  onSelectGarageFromSearch,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const durationHours = useMemo(
    () => getDurationHours(search.entryIso, search.exitIso),
    [search.entryIso, search.exitIso]
  );

  const suggestions = useMemo(() => {
    const q = search.query.trim().toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);

    const matchingDestinations = DESTINATION_PRESETS.filter((d) => {
      if (tokens.length === 0) return true;
      const haystack = `${d.name} ${d.subtitle} ${d.cityLabel} ${d.category} ${d.currency === 'INR' ? 'india' : 'usa'}`.toLowerCase();
      return tokens.every((t) => haystack.includes(t));
    });

    const matchingFacilities = q
      ? facilities.filter((f) => {
          const haystack = `${f.name} ${f.address} ${f.district} ${f.cityId}`.toLowerCase();
          return tokens.every((t) => haystack.includes(t));
        })
      : [];

    return {
      matchingDestinations,
      matchingFacilities: matchingFacilities.slice(0, 5),
    };
  }, [search.query, facilities]);

  const applyDurationPreset = (hours: number) => {
    const entry = new Date(search.entryIso);
    const base = Number.isNaN(entry.getTime()) ? new Date() : entry;
    const exit = new Date(base.getTime() + hours * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const exitIso = `${exit.getFullYear()}-${pad(exit.getMonth() + 1)}-${pad(exit.getDate())}T${pad(exit.getHours())}:${pad(exit.getMinutes())}`;
    onChangeSearch({ exitIso });
  };

  const trimmedQuery = search.query.trim();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.matchingDestinations.length > 0) {
        onSelectDestination(suggestions.matchingDestinations[0]);
      } else if (suggestions.matchingFacilities.length > 0) {
        onSelectGarageFromSearch(suggestions.matchingFacilities[0]);
      } else if (trimmedQuery) {
        onSelectCustomLocation(trimmedQuery);
      }
      setDropdownOpen(false);
    }
  };

  return (
    <section
      aria-label="Search parking slots"
      className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3"
    >
      <div className="max-w-[1440px] mx-auto space-y-3">
        {/* Primary search inputs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-stretch">
          {/* Destination / City / Street / Garage input — starts empty with no text to remove */}
          <div ref={containerRef} className="relative lg:col-span-5">
            <label htmlFor="parking-destination-input" className="sr-only">
              Type any location, street address, or landmark
            </label>
            <div className="flex items-center h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-lg focus-within:bg-white focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/15 transition-all">
              <Search className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" aria-hidden="true" />
              <input
                id="parking-destination-input"
                type="text"
                value={search.query}
                onFocus={() => setDropdownOpen(true)}
                onKeyDown={handleKeyDown}
                onChange={(e) => {
                  onChangeSearch({ query: e.target.value });
                  setDropdownOpen(true);
                }}
                placeholder={`Type location (currently: ${activeDestination.name.split('&')[0].trim()})`}
                className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              {search.query && (
                <button
                  type="button"
                  aria-label="Clear search query"
                  onClick={() => {
                    onChangeSearch({ query: '' });
                    setDropdownOpen(true);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {dropdownOpen && (
              <div className="absolute left-0 right-0 top-12 z-50 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-96 overflow-y-auto curb-scroll">
                {/* Custom New Location Action when user types anything */}
                {trimmedQuery.length >= 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectCustomLocation(trimmedQuery);
                      setDropdownOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 flex items-center gap-3 text-left bg-blue-50/70 hover:bg-blue-100/70 border-b border-blue-100 transition-colors cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-blue-950 truncate">
                        Find parking near &ldquo;{trimmedQuery}&rdquo;
                      </div>
                      <div className="text-xs text-blue-700">
                        Use this new location and show recommended parking slots nearby
                      </div>
                    </div>
                  </button>
                )}

                <div className="px-3.5 py-2 text-xs font-semibold text-slate-500 border-b border-slate-100 bg-slate-50">
                  {trimmedQuery ? 'Recommended Location Matches' : 'Recommended Cities & Landmarks'}
                </div>

                {suggestions.matchingDestinations.length > 0 ? (
                  <ul className="divide-y divide-slate-100">
                    {suggestions.matchingDestinations.map((dest) => (
                      <li key={dest.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectDestination(dest);
                            setDropdownOpen(false);
                          }}
                          className="w-full px-3.5 py-2.5 flex items-start gap-3 text-left hover:bg-blue-50/60 transition-colors cursor-pointer"
                        >
                          <MapPin className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-slate-900 truncate">
                              {dest.name}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              {dest.cityLabel} · {dest.category} · {dest.subtitle}
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-3.5 py-3 text-xs text-slate-500">
                    Press Enter or click above to search parking slots for &ldquo;{trimmedQuery}&rdquo;.
                  </div>
                )}

                {suggestions.matchingFacilities.length > 0 && (
                  <>
                    <div className="px-3.5 py-2 text-xs font-semibold text-slate-500 border-y border-slate-100 bg-slate-50">
                      Recommended Garages &amp; Lots
                    </div>
                    <ul className="divide-y divide-slate-100">
                      {suggestions.matchingFacilities.map((fac) => (
                        <li key={fac.id}>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectGarageFromSearch(fac);
                              setDropdownOpen(false);
                            }}
                            className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-900 truncate">
                                {fac.name}
                              </div>
                              <div className="text-xs text-slate-500 truncate">
                                {fac.address} · {fac.district}
                              </div>
                            </div>
                            <span className="text-xs font-mono font-semibold text-blue-600 tabular-nums shrink-0">
                              {formatCurrency(fac.hourlyRate, fac.currency)}/hr
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Entry & Exit Times */}
          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex items-center h-11 px-3 bg-slate-50 border border-slate-200 rounded-lg focus-within:bg-white focus-within:border-blue-600">
              <Clock className="w-4 h-4 text-slate-400 shrink-0 mr-2" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <label htmlFor="entry-time" className="block text-[10px] font-semibold text-slate-500 leading-none mb-0.5">
                  Enter After
                </label>
                <input
                  id="entry-time"
                  type="datetime-local"
                  value={search.entryIso}
                  onChange={(e) => onChangeSearch({ entryIso: e.target.value })}
                  className="w-full bg-transparent text-xs font-medium text-slate-900 tabular-nums focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center h-11 px-3 bg-slate-50 border border-slate-200 rounded-lg focus-within:bg-white focus-within:border-blue-600">
              <Clock className="w-4 h-4 text-slate-400 shrink-0 mr-2" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <label htmlFor="exit-time" className="block text-[10px] font-semibold text-slate-500 leading-none mb-0.5">
                  Exit Before ({formatDurationLabel(durationHours)})
                </label>
                <input
                  id="exit-time"
                  type="datetime-local"
                  value={search.exitIso}
                  min={search.entryIso}
                  onChange={(e) => onChangeSearch({ exitIso: e.target.value })}
                  className="w-full bg-transparent text-xs font-medium text-slate-900 tabular-nums focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Vehicle Size */}
          <div className="lg:col-span-2 flex items-center h-11 px-3 bg-slate-50 border border-slate-200 rounded-lg focus-within:bg-white focus-within:border-blue-600">
            <Car className="w-4 h-4 text-slate-400 shrink-0 mr-2" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <label htmlFor="vehicle-size-select" className="block text-[10px] font-semibold text-slate-500 leading-none mb-0.5">
                Vehicle Type
              </label>
              <select
                id="vehicle-size-select"
                value={search.vehicleSize}
                onChange={(e) => onChangeSearch({ vehicleSize: e.target.value as VehicleSize })}
                className="w-full bg-transparent text-xs font-semibold text-slate-900 focus:outline-none cursor-pointer"
              >
                {(Object.keys(VEHICLE_LABELS) as VehicleSize[]).map((size) => (
                  <option key={size} value={size}>
                    {VEHICLE_LABELS[size]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Filter & Sort Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 mr-1 shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              Filters
            </span>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {FILTER_OPTIONS.map((opt) => {
                const active = search.activeFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChangeSearch({ activeFilter: opt.id })}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-white text-slate-900 shadow-sm font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 ml-auto">
            <div className="hidden xl:flex items-center gap-1 text-xs">
              <span className="text-slate-500 mr-1">Stay:</span>
              {[
                { label: '2h', hours: 2 },
                { label: '4h', hours: 4 },
                { label: '8h', hours: 8 },
                { label: '24h', hours: 24 },
              ].map((preset) => {
                const isMatched = Math.abs(durationHours - preset.hours) < 0.25;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyDurationPreset(preset.hours)}
                    className={`px-2.5 py-1 rounded-md font-mono font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isMatched
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              <label htmlFor="sort-select" className="sr-only">
                Sort parking results
              </label>
              <select
                id="sort-select"
                value={search.sortBy}
                onChange={(e) => onChangeSearch({ sortBy: e.target.value as SortOption })}
                className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="recommended">Sort: Recommended</option>
                <option value="price_asc">Sort: Lowest Price</option>
                <option value="distance_asc">Sort: Closest Walk</option>
                <option value="rating_desc">Sort: Highest Rated</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
