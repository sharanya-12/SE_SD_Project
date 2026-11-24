import React, { useMemo, useState } from 'react';
import {
  Check,
  Plus,
  Search,
  Building2,
  XCircle,
  Users,
} from 'lucide-react';
import { AuthUser, CityId, ParkingFacility, Reservation, UserRole } from '../types/parking';
import { formatCurrency } from '../data/parkingData';

interface AdminDashboardProps {
  adminUser: AuthUser;
  facilities: ParkingFacility[];
  reservations: Reservation[];
  onUpdateFacility: (
    facilityId: string,
    patch: { hourlyRate: number; dailyMaxRate: number; availableSpots: number; accessHours: string }
  ) => Promise<boolean>;
  onCreateFacility: (payload: {
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
  }) => Promise<boolean>;
  users: AuthUser[];
  onCreateUser: (payload: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    defaultPlate?: string;
    defaultVehicle?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onCancelReservation: (id: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminUser,
  facilities,
  reservations,
  users,
  onUpdateFacility,
  onCreateFacility,
  onCreateUser,
  onCancelReservation,
}) => {
  const [activeTab, setActiveTab] = useState<'facilities' | 'ledger' | 'add_facility' | 'users'>(
    'facilities'
  );
  const [cityFilter, setCityFilter] = useState<'all' | CityId>('all');
  const [ledgerQuery, setLedgerQuery] = useState('');
  const [editingDrafts, setEditingDrafts] = useState<
    Record<
      string,
      { hourlyRate: string; dailyMaxRate: string; availableSpots: string; accessHours: string }
    >
  >({});
  const [savedFacilityId, setSavedFacilityId] = useState<string | null>(null);

  // Add Facility Form State
  const [newCityId, setNewCityId] = useState<CityId>('warangal');
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newDistrict, setNewDistrict] = useState('Hanamkonda, Warangal');
  const [newHourly, setNewHourly] = useState('35');
  const [newDailyMax, setNewDailyMax] = useState('160');
  const [newClearance, setNewClearance] = useState("7'0\"");
  const [newType, setNewType] = useState<ParkingFacility['facilityType']>('Garage');
  const [addMessage, setAddMessage] = useState('');

  // Add User/Admin Form State
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('user');
  const [newUserPlate, setNewUserPlate] = useState('');
  const [userFormMessage, setUserFormMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const visibleFacilities = useMemo(
    () =>
      cityFilter === 'all'
        ? facilities
        : facilities.filter((f) => f.cityId === cityFilter),
    [facilities, cityFilter]
  );

  const metrics = useMemo(() => {
    const activeRes = reservations.filter((r) => r.status !== 'cancelled');
    const inrRevenue = activeRes
      .filter((r) => (r.currency || 'INR') === 'INR')
      .reduce((sum, r) => sum + r.totalPaid, 0);
    const openBays = facilities.reduce((sum, f) => sum + f.availableSpots, 0);
    return {
      facilityCount: facilities.length,
      openBays,
      activeReservations: activeRes.length,
      inrRevenue,
    };
  }, [facilities, reservations]);

  const filteredReservations = useMemo(() => {
    const q = ledgerQuery.trim().toLowerCase();
    if (!q) return reservations;
    return reservations.filter(
      (r) =>
        r.passCode.toLowerCase().includes(q) ||
        r.driverName.toLowerCase().includes(q) ||
        r.licensePlate.toLowerCase().includes(q) ||
        r.facilityName.toLowerCase().includes(q)
    );
  }, [reservations, ledgerQuery]);

  const getDraft = (fac: ParkingFacility) =>
    editingDrafts[fac.id] || {
      hourlyRate: fac.currency === 'INR' ? String(fac.hourlyRate) : fac.hourlyRate.toFixed(2),
      dailyMaxRate: String(fac.dailyMaxRate),
      availableSpots: String(fac.availableSpots),
      accessHours: fac.accessHours,
    };

  const setDraftField = (
    fac: ParkingFacility,
    field: 'hourlyRate' | 'dailyMaxRate' | 'availableSpots' | 'accessHours',
    value: string
  ) => {
    const base = getDraft(fac);
    setEditingDrafts((prev) => ({
      ...prev,
      [fac.id]: { ...base, [field]: value },
    }));
  };

  const handleSaveRow = async (fac: ParkingFacility) => {
    const draft = getDraft(fac);
    const ok = await onUpdateFacility(fac.id, {
      hourlyRate: Number(draft.hourlyRate) || fac.hourlyRate,
      dailyMaxRate: Number(draft.dailyMaxRate) || fac.dailyMaxRate,
      availableSpots: Number(draft.availableSpots),
      accessHours: draft.accessHours,
    });
    if (ok) {
      setSavedFacilityId(fac.id);
      setTimeout(() => setSavedFacilityId(null), 2000);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddMessage('');
    const ok = await onCreateFacility({
      cityId: newCityId,
      name: newName,
      address: newAddress,
      district: newDistrict,
      hourlyRate: Number(newHourly) || 35,
      dailyMaxRate: Number(newDailyMax) || 160,
      clearanceLabel: newClearance,
      facilityType: newType,
      mapX: 480 + Math.round((Math.random() - 0.5) * 180),
      mapY: 320 + Math.round((Math.random() - 0.5) * 140),
    });

    if (ok) {
      setAddMessage(`Added "${newName}" to the live map and driver inventory.`);
      setNewName('');
      setNewAddress('');
      setActiveTab('facilities');
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormMessage(null);
    const result = await onCreateUser({
      name: newUserName,
      email: newUserEmail,
      password: newUserPassword,
      role: newUserRole,
      defaultPlate: newUserPlate || undefined,
    });
    if (result.ok) {
      setUserFormMessage({
        type: 'ok',
        text: `Created ${newUserRole === 'admin' ? 'Admin' : 'Driver'} account for ${newUserEmail}.`,
      });
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserPlate('');
    } else {
      setUserFormMessage({
        type: 'err',
        text: result.error || 'Could not create account.',
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-semibold text-blue-600">
            Admin Operations · Signed in as {adminUser.name}
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
            Garage Inventory &amp; Reservations Console
          </h1>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setActiveTab('facilities')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === 'facilities'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Facilities &amp; Rates
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === 'ledger'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Reservations Ledger ({reservations.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('add_facility')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === 'add_facility'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Add Facility
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === 'users'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Users ({users.length})
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Managed Facilities</div>
          <div className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {metrics.facilityCount}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Open Bays Systemwide</div>
          <div className="font-mono text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
            {metrics.openBays}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Active &amp; Upcoming Passes</div>
          <div className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {metrics.activeReservations}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">India Booking Volume</div>
          <div className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {formatCurrency(metrics.inrRevenue, 'INR', 0)}
          </div>
        </div>
      </div>

      {addMessage && (
        <div className="mt-4 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900">
          {addMessage}
        </div>
      )}

      {/* Tab 1: Facilities & Rate Control Table */}
      {activeTab === 'facilities' && (
        <div className="mt-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Live Pricing &amp; Capacity Controls
            </h2>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'all', label: 'All Cities' },
                  { id: 'warangal', label: 'Warangal' },
                  { id: 'hyderabad', label: 'Hyderabad' },
                  { id: 'bengaluru', label: 'Bengaluru' },
                  { id: 'chicago', label: 'Chicago' },
                ] as const
              ).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCityFilter(c.id)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                    cityFilter === c.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Facility</th>
                  <th className="py-3 px-4">City / District</th>
                  <th className="py-3 px-4 text-right">Hourly</th>
                  <th className="py-3 px-4 text-right">Daily Max</th>
                  <th className="py-3 px-4 text-right">Open Bays</th>
                  <th className="py-3 px-4">Access Hours</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleFacilities.map((fac) => {
                  const draft = getDraft(fac);
                  const isSaved = savedFacilityId === fac.id;
                  const unit = fac.currency === 'INR' ? '₹' : '$';
                  return (
                    <tr key={fac.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{fac.name}</div>
                        <div className="text-xs text-slate-500">{fac.address}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {fac.district}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className="text-xs font-mono text-slate-400 mr-1">{unit}</span>
                        <input
                          type="number"
                          step={fac.currency === 'INR' ? '5' : '0.25'}
                          min="1"
                          aria-label={`Hourly rate for ${fac.name}`}
                          value={draft.hourlyRate}
                          onChange={(e) => setDraftField(fac, 'hourlyRate', e.target.value)}
                          className="w-20 h-8 px-2 text-right font-mono text-xs border border-slate-200 rounded bg-white tabular-nums focus:outline-none focus:border-blue-600"
                        />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className="text-xs font-mono text-slate-400 mr-1">{unit}</span>
                        <input
                          type="number"
                          step={fac.currency === 'INR' ? '10' : '1'}
                          min="5"
                          aria-label={`Daily max rate for ${fac.name}`}
                          value={draft.dailyMaxRate}
                          onChange={(e) => setDraftField(fac, 'dailyMaxRate', e.target.value)}
                          className="w-20 h-8 px-2 text-right font-mono text-xs border border-slate-200 rounded bg-white tabular-nums focus:outline-none focus:border-blue-600"
                        />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <input
                          type="number"
                          min="0"
                          max={fac.totalSpots}
                          aria-label={`Available bays for ${fac.name}`}
                          value={draft.availableSpots}
                          onChange={(e) => setDraftField(fac, 'availableSpots', e.target.value)}
                          className="w-16 h-8 px-2 text-right font-mono text-xs border border-slate-200 rounded bg-white tabular-nums focus:outline-none focus:border-blue-600"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          aria-label={`Access hours for ${fac.name}`}
                          value={draft.accessHours}
                          onChange={(e) => setDraftField(fac, 'accessHours', e.target.value)}
                          className="w-36 h-8 px-2 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:border-blue-600"
                        />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleSaveRow(fac)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                            isSaved
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-900 hover:bg-blue-600 text-white'
                          }`}
                        >
                          {isSaved ? (
                            <>
                              <Check className="w-3.5 h-3.5" aria-hidden="true" />
                              Saved
                            </>
                          ) : (
                            'Save'
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Reservations Ledger */}
      {activeTab === 'ledger' && (
        <div className="mt-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">
              All Platform Reservations
            </h2>
            <div className="flex items-center h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 mr-2" aria-hidden="true" />
              <input
                type="text"
                value={ledgerQuery}
                onChange={(e) => setLedgerQuery(e.target.value)}
                placeholder="Search pass, driver, or plate..."
                className="w-full bg-transparent text-xs text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Pass Code</th>
                  <th className="py-3 px-4">Driver</th>
                  <th className="py-3 px-4">Facility &amp; Bay</th>
                  <th className="py-3 px-4">Plate</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReservations.map((res) => (
                  <tr key={res.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 tabular-nums">
                      {res.passCode}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs font-semibold text-slate-900">{res.driverName}</div>
                      <div className="text-[11px] text-slate-500">{res.driverEmail}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs font-medium text-slate-900">{res.facilityName}</div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {res.bayLevel} · {res.bayCode}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700">
                      {res.licensePlate}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold">
                      <span
                        className={
                          res.status === 'cancelled'
                            ? 'text-red-700'
                            : 'text-emerald-700'
                        }
                      >
                        {res.status === 'cancelled'
                          ? 'Cancelled'
                          : res.isMonthly
                          ? 'Monthly Active'
                          : 'Confirmed'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(res.totalPaid, res.currency || 'INR')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {res.status !== 'cancelled' ? (
                        <button
                          type="button"
                          onClick={() => onCancelReservation(res.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-700 border border-red-200 rounded hover:bg-red-50 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          Void
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Add New Facility */}
      {activeTab === 'add_facility' && (
        <div className="mt-6 max-w-2xl bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-2 text-slate-900 pb-4 border-b border-slate-100">
            <Building2 className="w-5 h-5 text-blue-600" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold">
              Register New Parking Facility
            </h2>
          </div>

          <form onSubmit={handleAddSubmit} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="new-fac-city" className="block text-xs font-semibold text-slate-700 mb-1">
                  City
                </label>
                <select
                  id="new-fac-city"
                  value={newCityId}
                  onChange={(e) => {
                    const c = e.target.value as CityId;
                    setNewCityId(c);
                    if (c === 'warangal') setNewDistrict('Hanamkonda, Warangal');
                    else if (c === 'hyderabad') setNewDistrict('HITEC City, Hyderabad');
                    else if (c === 'bengaluru') setNewDistrict('Indiranagar, Bengaluru');
                    else setNewDistrict('Downtown Loop');
                  }}
                  className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-600"
                >
                  <option value="warangal">Warangal, Telangana (India)</option>
                  <option value="hyderabad">Hyderabad, Telangana (India)</option>
                  <option value="bengaluru">Bengaluru, Karnataka (India)</option>
                  <option value="chicago">Chicago, IL (USA)</option>
                </select>
              </div>
              <div>
                <label htmlFor="new-fac-name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Facility Name
                </label>
                <input
                  id="new-fac-name"
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Subedari Smart Plaza"
                  className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label htmlFor="new-fac-addr" className="block text-xs font-semibold text-slate-700 mb-1">
                  Street Address
                </label>
                <input
                  id="new-fac-addr"
                  type="text"
                  required
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="Subedari Main Rd, Warangal"
                  className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label htmlFor="new-fac-district" className="block text-xs font-semibold text-slate-700 mb-1">
                  Area / Locality
                </label>
                <input
                  id="new-fac-district"
                  type="text"
                  required
                  value={newDistrict}
                  onChange={(e) => setNewDistrict(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label htmlFor="new-fac-type" className="block text-xs font-semibold text-slate-700 mb-1">
                  Facility Type
                </label>
                <select
                  id="new-fac-type"
                  value={newType}
                  onChange={(e) =>
                    setNewType(e.target.value as ParkingFacility['facilityType'])
                  }
                  className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-600"
                >
                  <option value="Garage">Garage</option>
                  <option value="Surface Lot">Surface Lot</option>
                  <option value="Valet Garage">Valet Garage</option>
                  <option value="Airport Deck">Airport Deck</option>
                </select>
              </div>
              <div>
                <label htmlFor="new-fac-hourly" className="block text-xs font-semibold text-slate-700 mb-1">
                  Hourly Rate ({newCityId === 'chicago' ? 'USD $' : 'INR ₹'})
                </label>
                <input
                  id="new-fac-hourly"
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={newHourly}
                  onChange={(e) => setNewHourly(e.target.value)}
                  className="w-full h-10 px-3 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label htmlFor="new-fac-max" className="block text-xs font-semibold text-slate-700 mb-1">
                  Daily Max ({newCityId === 'chicago' ? 'USD $' : 'INR ₹'})
                </label>
                <input
                  id="new-fac-max"
                  type="number"
                  min="5"
                  required
                  value={newDailyMax}
                  onChange={(e) => setNewDailyMax(e.target.value)}
                  className="w-full h-10 px-3 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label htmlFor="new-fac-clearance" className="block text-xs font-semibold text-slate-700 mb-1">
                  Max Clearance
                </label>
                <input
                  id="new-fac-clearance"
                  type="text"
                  value={newClearance}
                  onChange={(e) => setNewClearance(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Publish Facility to Map
            </button>
          </form>
        </div>
      )}

      {/* Tab 4: Registered Users & Admin Accounts */}
      {activeTab === 'users' && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-slate-900">
                  Registered Accounts ({users.length})
                </h2>
              </div>
              <span className="text-xs text-slate-500">Persisted in backend store</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Name &amp; Email</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Saved Vehicle / Plate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <div className="text-xs font-semibold text-slate-900">{u.name}</div>
                        <div className="text-[11px] text-slate-500">{u.email}</div>
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold">
                        <span className={u.role === 'admin' ? 'text-blue-700' : 'text-slate-700'}>
                          {u.role === 'admin' ? 'Administrator' : 'Driver'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {u.defaultPlate || u.defaultVehicle ? (
                          <span>
                            {u.defaultPlate ? <span className="font-mono font-semibold">{u.defaultPlate}</span> : null}
                            {u.defaultPlate && u.defaultVehicle ? ' · ' : ''}
                            {u.defaultVehicle || ''}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-display text-base font-bold text-slate-900">
              Create Driver or Admin Credentials
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Accounts created here are hashed and saved to the backend database immediately.
            </p>

            <form onSubmit={handleCreateUserSubmit} className="mt-4 space-y-3.5">
              <div>
                <label htmlFor="adm-new-name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  id="adm-new-name"
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Priya Sharma"
                  className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label htmlFor="adm-new-email" className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  id="adm-new-email"
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="priya@example.com"
                  className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="adm-new-pass" className="block text-xs font-semibold text-slate-700 mb-1">
                    Password
                  </label>
                  <input
                    id="adm-new-pass"
                    type="password"
                    required
                    minLength={6}
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Min. 6 chars"
                    className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label htmlFor="adm-new-role" className="block text-xs font-semibold text-slate-700 mb-1">
                    Role
                  </label>
                  <select
                    id="adm-new-role"
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="w-full h-9 px-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-600"
                  >
                    <option value="user">Driver</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="adm-new-plate" className="block text-xs font-semibold text-slate-700 mb-1">
                  License Plate (Optional)
                </label>
                <input
                  id="adm-new-plate"
                  type="text"
                  value={newUserPlate}
                  onChange={(e) => setNewUserPlate(e.target.value)}
                  placeholder="TS 03 AB 1234"
                  className="w-full h-9 px-3 text-sm font-mono uppercase border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              {userFormMessage && (
                <div
                  className={`p-2.5 rounded-lg text-xs font-medium border ${
                    userFormMessage.type === 'ok'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                >
                  {userFormMessage.text}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Create Account
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
