import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { List, Map as MapIcon } from 'lucide-react';
import {
  AppView,
  AuthUser,
  CityId,
  DestinationPreset,
  ParkingFacility,
  Reservation,
  SearchState,
  UserRole,
} from './types/parking';
import {
  DESTINATION_PRESETS,
  PARKING_FACILITIES,
  buildCustomLocationData,
  calculateFacilityPrice,
  getDefaultSearchTimes,
  getDistanceMiles,
  getDurationHours,
  isVehicleCompatible,
} from './data/parkingData';
import { TopBar } from './components/TopBar';
import { SearchToolbar } from './components/SearchToolbar';
import { FacilityList } from './components/FacilityList';
import { ParkingMap } from './components/ParkingMap';
import { FacilityDetailDrawer } from './components/FacilityDetailDrawer';
import { MyPassesView } from './components/MyPassesView';
import {
  HowItWorksView,
  MonthlyPassesView,
  VenuesAirportsView,
} from './components/SecondaryViews';
import { AdminLoginPage, UserLoginPage } from './components/AuthViews';
import { AdminDashboard } from './components/AdminDashboard';

const TOKEN_KEY = 'curbgrid_auth_token_v1';

export default function App() {
  const defaultTimes = useMemo(() => getDefaultSearchTimes(), []);

  const [authToken, setAuthToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(Boolean(authToken));
  const [activeView, setActiveView] = useState<AppView>('user_login');
  const [mobilePane, setMobilePane] = useState<'list' | 'map'>('list');

  const [facilitiesData, setFacilitiesData] = useState<ParkingFacility[]>(PARKING_FACILITIES);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [adminUsers, setAdminUsers] = useState<AuthUser[]>([]);
  const [customLocation, setCustomLocation] = useState<{
    destination: DestinationPreset;
    facilities: ParkingFacility[];
  } | null>(null);

  // Search box starts empty ('') so the user never has to delete pre-filled text before typing
  const [search, setSearch] = useState<SearchState>({
    query: '',
    destinationId: DESTINATION_PRESETS[0].id,
    entryIso: defaultTimes.entryIso,
    exitIso: defaultTimes.exitIso,
    vehicleSize: 'sedan',
    activeFilter: 'all',
    sortBy: 'recommended',
  });

  const fetchAuthenticatedData = useCallback(async (token: string, role?: UserRole) => {
    try {
      const requests: Promise<Response>[] = [
        fetch('/api/facilities', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/reservations', { headers: { Authorization: `Bearer ${token}` } }),
      ];
      if (role === 'admin') {
        requests.push(
          fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
        );
      }

      const [facRes, resRes, usersRes] = await Promise.all(requests);
      if (facRes.ok) {
        const facData = await facRes.json();
        if (Array.isArray(facData.facilities)) {
          setFacilitiesData(facData.facilities);
        }
      }
      if (resRes.ok) {
        const resData = await resRes.json();
        if (Array.isArray(resData.reservations)) {
          setReservations(resData.reservations);
        }
      }
      if (usersRes && usersRes.ok) {
        const usersData = await usersRes.json();
        if (Array.isArray(usersData.users)) {
          setAdminUsers(usersData.users);
        }
      }
    } catch {
      // Keep fallback facilities if network hiccups
    }
  }, []);

  useEffect(() => {
    if (!authToken) {
      setAuthChecking(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
          setActiveView(data.user.role === 'admin' ? 'admin_dashboard' : 'finder');
          await fetchAuthenticatedData(authToken, data.user.role);
        } else if (!cancelled) {
          setAuthToken(null);
          setCurrentUser(null);
          setActiveView('user_login');
          try {
            localStorage.removeItem(TOKEN_KEY);
          } catch {
            // Ignore storage errors
          }
        }
      } catch {
        if (!cancelled) {
          setAuthToken(null);
          setCurrentUser(null);
          setActiveView('user_login');
        }
      } finally {
        if (!cancelled) setAuthChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authToken, fetchAuthenticatedData]);

  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [destinationSelected, setDestinationSelected] = useState(false);
  const [hoveredFacilityId, setHoveredFacilityId] = useState<string | null>(null);
  const [inspectingFacilityId, setInspectingFacilityId] = useState<string | null>(null);

  // Merge custom location facilities (if active) + server facilities with live bay counts
  const allKnownFacilities = useMemo<ParkingFacility[]>(() => {
    return customLocation
      ? [...customLocation.facilities, ...facilitiesData]
      : facilitiesData;
  }, [customLocation, facilitiesData]);

  const liveFacilities = useMemo<ParkingFacility[]>(() => {
    const activeReservations = reservations.filter(
      (r) => r.status === 'upcoming' || r.status === 'active'
    );

    return allKnownFacilities.map((fac) => {
      const facilityRes = activeReservations.filter((r) => r.facilityId === fac.id);
      if (facilityRes.length === 0) return fac;

      const reservedCodes = new Set(facilityRes.map((r) => r.bayCode));
      const updatedBays = fac.bays.map((b) =>
        reservedCodes.has(b.code) && b.status === 'available'
          ? { ...b, status: 'reserved' as const }
          : b
      );
      const openCount = updatedBays.filter((b) => b.status === 'available').length;
      return {
        ...fac,
        bays: updatedBays,
        availableSpots: openCount,
      };
    });
  }, [allKnownFacilities, reservations]);

  // Resolve active destination (uses custom location if selected, or dynamically switches city as user types)
  const activeDestination = useMemo<DestinationPreset>(() => {
    if (customLocation && search.destinationId === customLocation.destination.id) {
      return customLocation.destination;
    }

    const q = search.query.trim().toLowerCase();
    if (q) {
      const tokens = q.split(/\s+/).filter(Boolean);
      const match = DESTINATION_PRESETS.find((d) => {
        const haystack = `${d.name} ${d.subtitle} ${d.cityLabel} ${d.cityId} ${d.currency === 'INR' ? 'india' : 'usa'}`.toLowerCase();
        return tokens.every((t) => haystack.includes(t));
      });
      if (match) return match;
    }

    return (
      DESTINATION_PRESETS.find((d) => d.id === search.destinationId) ||
      DESTINATION_PRESETS[0]
    );
  }, [customLocation, search.destinationId, search.query]);

  const durationHours = useMemo(
    () => getDurationHours(search.entryIso, search.exitIso),
    [search.entryIso, search.exitIso]
  );

  // Filter & Sort parking facilities for the active destination without dropping results while typing
  const filteredFacilities = useMemo(() => {
    const rawQuery = search.query.trim().toLowerCase();

    let list = liveFacilities.filter((fac) => {
      if (fac.cityId !== activeDestination.cityId) {
        return false;
      }
      if (
        customLocation &&
        activeDestination.cityId === 'custom' &&
        !customLocation.facilities.some((cf) => cf.id === fac.id)
      ) {
        return false;
      }

      if (search.activeFilter !== 'all' && !fac.amenities.includes(search.activeFilter)) {
        return false;
      }

      return true;
    });

    // If user typed a specific garage/street keyword inside the active city, boost matching ones to top (and still keep recommendations visible)
    list = [...list].sort((a, b) => {
      if (rawQuery) {
        const aHit = `${a.name} ${a.address} ${a.district}`.toLowerCase().includes(rawQuery) ? 1 : 0;
        const bHit = `${b.name} ${b.address} ${b.district}`.toLowerCase().includes(rawQuery) ? 1 : 0;
        if (aHit !== bHit) return bHit - aHit;
      }

      const distA = getDistanceMiles(a, activeDestination).miles;
      const distB = getDistanceMiles(b, activeDestination).miles;
      const priceA = calculateFacilityPrice(a, durationHours, search.vehicleSize).total;
      const priceB = calculateFacilityPrice(b, durationHours, search.vehicleSize).total;
      const compatA = isVehicleCompatible(a, search.vehicleSize) ? 0 : 1;
      const compatB = isVehicleCompatible(b, search.vehicleSize) ? 0 : 1;

      if (search.sortBy === 'price_asc') return priceA - priceB;
      if (search.sortBy === 'distance_asc') return distA - distB;
      if (search.sortBy === 'rating_desc') return b.rating - a.rating;

      if (compatA !== compatB) return compatA - compatB;
      const scoreA = distA * 18 + priceA * 0.45 - a.rating * 2.5;
      const scoreB = distB * 18 + priceB * 0.45 - b.rating * 2.5;
      return scoreA - scoreB;
    });

    return list;
  }, [liveFacilities, customLocation, search, activeDestination, durationHours]);

  const inspectingFacility = useMemo(
    () => liveFacilities.find((f) => f.id === inspectingFacilityId) || null,
    [liveFacilities, inspectingFacilityId]
  );

  const activePassCount = useMemo(
    () => reservations.filter((r) => r.status !== 'cancelled').length,
    [reservations]
  );

  const handleAuthSuccess = async (user: AuthUser, token: string) => {
    setAuthToken(token);
    setCurrentUser(user);
    setAuthChecking(false);
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Ignore storage error
    }
    await fetchAuthenticatedData(token, user.role);
    setActiveView(user.role === 'admin' ? 'admin_dashboard' : 'finder');
  };

  const handleSignOut = () => {
    setAuthToken(null);
    setCurrentUser(null);
    setReservations([]);
    setAdminUsers([]);
    setInspectingFacilityId(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Ignore storage error
    }
    setActiveView('user_login');
  };

  const handleSelectView = (view: AppView) => {
    if (!currentUser) {
      setActiveView(view === 'admin_login' ? 'admin_login' : 'user_login');
      return;
    }
    if (view === 'admin_dashboard' && currentUser.role !== 'admin') {
      setActiveView('finder');
      return;
    }
    setActiveView(view);
  };

  const handleSelectDestination = (dest: DestinationPreset) => {
    setDestinationSelected(true);
    const entry = new Date(search.entryIso);
    const base = Number.isNaN(entry.getTime()) ? new Date() : entry;
    const exit = new Date(base.getTime() + dest.defaultDurationHours * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const exitIso = `${exit.getFullYear()}-${pad(exit.getMonth() + 1)}-${pad(exit.getDate())}T${pad(exit.getHours())}:${pad(exit.getMinutes())}`;

    setCustomLocation(null);
    setSelectedFacilityId(null);

    setSearch((prev) => ({
      ...prev,
      destinationId: dest.id,
      query: dest.name,
      exitIso,
    }));
    setActiveView('finder');
  };

  const handleSelectCustomLocation = (locationName: string) => {
    setDestinationSelected(true);
    const custom = buildCustomLocationData(locationName);
    setCustomLocation(custom);
    setSelectedFacilityId(null);
    setSearch((prev) => ({
      ...prev,
      destinationId: custom.destination.id,
      query: locationName,
    }));
    setActiveView('finder');
  };

  const handleSelectGarageFromSearch = (facility: ParkingFacility) => {
    setDestinationSelected(true);
    const matchingDest =
      DESTINATION_PRESETS.find((d) => d.cityId === facility.cityId) ||
      activeDestination;

    setCustomLocation(null);
    setSearch((prev) => ({
      ...prev,
      destinationId: matchingDest.id,
      query: facility.name,
    }));
    setSelectedFacilityId(facility.id);
    setInspectingFacilityId(facility.id);
    setActiveView('finder');
  };

  const handleResetFilters = () => {
    setSearch((prev) => ({
      ...prev,
      query: '',
      activeFilter: 'all',
      vehicleSize: 'sedan',
    }));
  };

  const handleConfirmReservation = async (res: Reservation) => {
    if (!authToken) return;
    setReservations((prev) => [res, ...prev]);
    setCurrentUser((prev) =>
      prev
        ? {
            ...prev,
            defaultPlate: prev.defaultPlate || res.licensePlate,
            defaultVehicle: prev.defaultVehicle || res.vehicleModel,
          }
        : prev
    );
    try {
      await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(res),
      });
    } catch {
      // Keep local state if network hiccups
    }
  };

  const handleExtendReservation = async (id: string) => {
    if (!authToken) return;
    setReservations((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const fac = allKnownFacilities.find((f) => f.id === r.facilityId);
        const hourlyAdd = fac ? fac.hourlyRate : r.currency === 'INR' ? 35 : 5;
        const currentExit = new Date(r.exitIso);
        const nextExit = new Date(currentExit.getTime() + 60 * 60 * 1000);
        const pad = (n: number) => String(n).padStart(2, '0');
        const nextExitIso = `${nextExit.getFullYear()}-${pad(nextExit.getMonth() + 1)}-${pad(nextExit.getDate())}T${pad(nextExit.getHours())}:${pad(nextExit.getMinutes())}`;
        return {
          ...r,
          exitIso: nextExitIso,
          subtotal: Math.round((r.subtotal + hourlyAdd) * 100) / 100,
          totalPaid: Math.round((r.totalPaid + hourlyAdd) * 100) / 100,
        };
      })
    );

    try {
      await fetch(`/api/reservations/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ action: 'extend' }),
      });
    } catch {
      // Local state already updated
    }
  };

  const handleCancelReservation = async (id: string) => {
    if (!authToken) return;
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r))
    );

    try {
      await fetch(`/api/reservations/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ action: 'cancel' }),
      });
    } catch {
      // Local state already updated
    }
  };

  const handleAdminUpdateFacility = async (
    facilityId: string,
    patch: { hourlyRate: number; dailyMaxRate: number; availableSpots: number; accessHours: string }
  ): Promise<boolean> => {
    if (!authToken) return false;
    try {
      const res = await fetch(`/api/admin/facilities/${facilityId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(patch),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setFacilitiesData((prev) =>
        prev.map((f) => (f.id === facilityId ? data.facility : f))
      );
      return true;
    } catch {
      return false;
    }
  };

  const handleAdminCreateFacility = async (payload: {
    cityId: CityId;
    name: string;
    address: string;
    district: string;
    hourlyRate: number;
    dailyMaxRate: number;
    clearanceLabel: string;
    facilityType: ParkingFacility['facilityType'];
    mapX: number;
    mapY: number;
  }): Promise<boolean> => {
    if (!authToken) return false;
    try {
      const res = await fetch('/api/admin/facilities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setFacilitiesData((prev) => [data.facility, ...prev]);
      return true;
    } catch {
      return false;
    }
  };

  const handleAdminCreateUser = async (payload: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    defaultPlate?: string;
    defaultVehicle?: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    if (!authToken) return { ok: false, error: 'Not authenticated.' };
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || 'Failed to create account.' };
      }
      setAdminUsers((prev) => [...prev, data.user]);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error connecting to backend.' };
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm font-medium text-slate-600">
          Verifying session...
        </div>
      </div>
    );
  }

  // Strictly require User or Admin login before opening the app
  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <TopBar
          activeView={activeView === 'admin_login' ? 'admin_login' : 'user_login'}
          onSelectView={handleSelectView}
          activePassCount={0}
          currentUser={null}
          onSignOut={handleSignOut}
        />
        <main className="flex-1">
          {activeView === 'admin_login' ? (
            <AdminLoginPage
              onAuthSuccess={handleAuthSuccess}
              onSwitchToUser={() => setActiveView('user_login')}
            />
          ) : (
            <UserLoginPage
              onAuthSuccess={handleAuthSuccess}
              onSwitchToAdmin={() => setActiveView('admin_login')}
            />
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeView={activeView}
        onSelectView={handleSelectView}
        activePassCount={activePassCount}
        currentUser={currentUser}
        onSignOut={handleSignOut}
      />

      {activeView === 'finder' && (
        <>
          <SearchToolbar
            search={search}
            activeDestination={activeDestination}
            facilities={liveFacilities}
            onChangeSearch={(patch) => {
              // If user clears or types freely, never overwrite their input
              if (patch.query !== undefined) {
                setCustomLocation(null);
              }
              setSearch((prev) => ({ ...prev, ...patch }));
            }}
            onSelectDestination={handleSelectDestination}
            onSelectCustomLocation={handleSelectCustomLocation}
            onSelectGarageFromSearch={handleSelectGarageFromSearch}
          />

          {/* Mobile List / Map Switcher */}
          <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 tabular-nums">
              {filteredFacilities.length} spots in {activeDestination.cityLabel}
            </span>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setMobilePane('list')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                  mobilePane === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                <List className="w-3.5 h-3.5" aria-hidden="true" />
                List
              </button>
              <button
                type="button"
                onClick={() => setMobilePane('map')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                  mobilePane === 'map' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" aria-hidden="true" />
                Map
              </button>
            </div>
          </div>

          {/* Split-Screen Finder Workspace */}
          <main className="flex-1 flex flex-col lg:flex-row lg:h-[calc(100vh-12.5rem)] lg:min-h-[560px] overflow-hidden">
            <div
              className={`w-full lg:w-[460px] xl:w-[490px] shrink-0 h-full ${
                mobilePane === 'list' ? 'block' : 'hidden lg:block'
              }`}
            >
              <FacilityList
                facilities={filteredFacilities}
                destination={activeDestination}
                durationHours={durationHours}
                vehicleSize={search.vehicleSize}
                selectedFacilityId={selectedFacilityId}
                hoveredFacilityId={hoveredFacilityId}
                onSelectFacility={(fac) => setSelectedFacilityId(fac.id)}
                onHoverFacility={setHoveredFacilityId}
                onInspectFacility={(fac) => {
                  setSelectedFacilityId(fac.id);
                  setInspectingFacilityId(fac.id);
                }}
                onResetFilters={handleResetFilters}
              />
            </div>

            <div
              className={`flex-1 h-[540px] lg:h-full ${
                mobilePane === 'map' ? 'block' : 'hidden lg:block'
              }`}
            >
              <ParkingMap
                facilities={filteredFacilities}
                destination={activeDestination}
                destinationSelected={destinationSelected}
                durationHours={durationHours}
                vehicleSize={search.vehicleSize}
                selectedFacilityId={selectedFacilityId}
                hoveredFacilityId={hoveredFacilityId}
                onSelectFacility={(fac) => setSelectedFacilityId(fac.id)}
                onHoverFacility={setHoveredFacilityId}
                onInspectFacility={(fac) => {
                  setSelectedFacilityId(fac.id);
                  setInspectingFacilityId(fac.id);
                }}
              />
            </div>
          </main>
        </>
      )}

      {activeView === 'monthly' && (
        <main className="flex-1">
          <MonthlyPassesView
            facilities={liveFacilities}
            onReserveMonthly={handleConfirmReservation}
            onGoToPasses={() => setActiveView('passes')}
          />
        </main>
      )}

      {activeView === 'venues' && (
        <main className="flex-1">
          <VenuesAirportsView
            destinations={DESTINATION_PRESETS}
            onSelectDestination={handleSelectDestination}
          />
        </main>
      )}

      {activeView === 'how_it_works' && (
        <main className="flex-1">
          <HowItWorksView onStartSearching={() => setActiveView('finder')} />
        </main>
      )}

      {activeView === 'passes' && (
        <main className="flex-1">
          <MyPassesView
            reservations={reservations}
            onExtendReservation={handleExtendReservation}
            onCancelReservation={handleCancelReservation}
            onFindParking={() => setActiveView('finder')}
          />
        </main>
      )}

      {activeView === 'admin_dashboard' && currentUser.role === 'admin' && (
        <main className="flex-1">
          <AdminDashboard
            adminUser={currentUser}
            facilities={liveFacilities}
            reservations={reservations}
            users={adminUsers}
            onUpdateFacility={handleAdminUpdateFacility}
            onCreateFacility={handleAdminCreateFacility}
            onCreateUser={handleAdminCreateUser}
            onCancelReservation={handleCancelReservation}
          />
        </main>
      )}

      {/* Bay Inspector & Instant Reservation Drawer */}
      <FacilityDetailDrawer
        facility={inspectingFacility}
        destination={activeDestination}
        search={search}
        currentUser={currentUser}
        onClose={() => setInspectingFacilityId(null)}
        onConfirmReservation={handleConfirmReservation}
        onGoToPasses={() => setActiveView('passes')}
      />
    </div>
  );
}
