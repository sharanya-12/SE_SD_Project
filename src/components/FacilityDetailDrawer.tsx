import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  MapPin,
  ShieldCheck,
  Clock,
  Zap,
  Accessibility,
  CheckCircle2,
  AlertTriangle,
  Car,
} from 'lucide-react';
import {
  DestinationPreset,
  ParkingBay,
  ParkingFacility,
  Reservation,
  SearchState,
} from '../types/parking';
import {
  AMENITY_LABELS,
  VEHICLE_LABELS,
  calculateFacilityPrice,
  formatCurrency,
  formatDurationLabel,
  getDistanceMiles,
  getDurationHours,
  isVehicleCompatible,
} from '../data/parkingData';
import { QrCodeSvg } from './QrCodeSvg';

interface FacilityDetailDrawerProps {
  facility: ParkingFacility | null;
  destination: DestinationPreset;
  search: SearchState;
  currentUser: {
    id: string;
    name: string;
    email: string;
    defaultPlate?: string;
    defaultVehicle?: string;
  } | null;
  onClose: () => void;
  onConfirmReservation: (reservation: Reservation) => void;
  onGoToPasses: () => void;
}

export const FacilityDetailDrawer: React.FC<FacilityDetailDrawerProps> = ({
  facility,
  destination,
  search,
  currentUser,
  onClose,
  onConfirmReservation,
  onGoToPasses,
}) => {
  const [selectedLevel, setSelectedLevel] = useState<'P1' | 'P2'>('P1');
  const [selectedBayId, setSelectedBayId] = useState<string>('');
  const [driverName, setDriverName] = useState(currentUser?.name || '');
  const [driverEmail, setDriverEmail] = useState(currentUser?.email || '');
  const [licensePlate, setLicensePlate] = useState(currentUser?.defaultPlate || '');
  const [vehicleModel, setVehicleModel] = useState(currentUser?.defaultVehicle || '');
  const [formError, setFormError] = useState('');
  const [confirmedPass, setConfirmedPass] = useState<Reservation | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setDriverName(currentUser.name);
      setDriverEmail(currentUser.email);
      setLicensePlate(currentUser.defaultPlate || '');
      setVehicleModel(currentUser.defaultVehicle || '');
    }
  }, [currentUser]);

  useEffect(() => {
    if (!facility) return;
    setConfirmedPass(null);
    setFormError('');
    setImgFailed(false);
    const firstAvailable = facility.bays.find((b) => b.status === 'available');
    if (firstAvailable) {
      setSelectedLevel(firstAvailable.level);
      setSelectedBayId(firstAvailable.id);
    } else {
      setSelectedLevel('P1');
      setSelectedBayId('');
    }
  }, [facility]);

  const durationHours = useMemo(
    () => getDurationHours(search.entryIso, search.exitIso),
    [search.entryIso, search.exitIso]
  );

  if (!facility) return null;

  const { subtotal, serviceFee, total } = calculateFacilityPrice(
    facility,
    durationHours,
    search.vehicleSize
  );
  const { miles, km, walkMinutes } = getDistanceMiles(facility, destination);
  const distLabel = facility.currency === 'INR' ? `${km.toFixed(1)} km` : `${miles.toFixed(2)} mi`;
  const compatible = isVehicleCompatible(facility, search.vehicleSize);

  const levelBays = facility.bays.filter((b) => b.level === selectedLevel);
  const selectedBay: ParkingBay | undefined = facility.bays.find((b) => b.id === selectedBayId);

  const formatShortTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBay || selectedBay.status !== 'available') {
      setFormError('Please select an available parking bay from the floor map.');
      return;
    }
    if (!driverName.trim() || !licensePlate.trim()) {
      setFormError('Driver name and license plate are required for gate recognition.');
      return;
    }
    setFormError('');

    const codeNum = Math.floor(100000 + Math.random() * 899999);
    const newReservation: Reservation = {
      id: `res-${Date.now()}`,
      currency: facility.currency,
      passCode: `CG-${codeNum}`,
      facilityId: facility.id,
      facilityName: facility.name,
      facilityAddress: facility.address,
      facilityType: facility.facilityType,
      entryIso: search.entryIso,
      exitIso: search.exitIso,
      bayCode: selectedBay.code,
      bayLevel: selectedBay.level,
      vehicleSize: search.vehicleSize,
      licensePlate: licensePlate.trim().toUpperCase(),
      vehicleModel: vehicleModel.trim() || VEHICLE_LABELS[search.vehicleSize],
      driverName: driverName.trim(),
      driverEmail: driverEmail.trim() || 'driver@curbgrid.app',
      subtotal,
      serviceFee,
      totalPaid: total,
      status: 'upcoming',
      createdAt: new Date().toISOString(),
      entryInstructions: facility.entryInstructions,
    };

    onConfirmReservation(newReservation);
    setConfirmedPass(newReservation);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={`Reserve parking at ${facility.name}`}
    >
      <div className="flex-1" onClick={onClose} />

      <div className="w-full max-w-xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4 bg-white shrink-0">
          <div className="min-w-0">
            <span className="text-xs font-medium text-blue-600">
              {confirmedPass ? 'Digital Gate Pass Issued' : `${facility.operator} · ${facility.facilityType}`}
            </span>
            <h2 className="font-display text-lg font-bold text-slate-900 truncate">
              {facility.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close parking details"
            className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto curb-scroll">
          {confirmedPass ? (
            <div className="p-6 space-y-6">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-emerald-950">
                    Parking bay {confirmedPass.bayCode} reserved
                  </h3>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Scan the QR code below at the entry kiosk or rely on plate recognition ({confirmedPass.licensePlate}).
                  </p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-300">Pass Reference</div>
                    <div className="font-mono text-xl font-bold tracking-tight tabular-nums">
                      {confirmedPass.passCode}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-300">Assigned Stall</div>
                    <div className="font-mono text-lg font-semibold text-blue-300 tabular-nums">
                      {confirmedPass.bayLevel} · {confirmedPass.bayCode}
                    </div>
                  </div>
                </div>

                <div className="p-5 flex flex-col sm:flex-row items-center gap-5">
                  <QrCodeSvg value={confirmedPass.passCode} size={136} />
                  <div className="flex-1 space-y-2.5 text-sm w-full">
                    <div>
                      <div className="text-xs text-slate-500">Enter After</div>
                      <div className="font-medium text-slate-900 tabular-nums">
                        {formatShortTime(confirmedPass.entryIso)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Exit Before</div>
                      <div className="font-medium text-slate-900 tabular-nums">
                        {formatShortTime(confirmedPass.exitIso)}
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        {confirmedPass.vehicleModel} · {confirmedPass.licensePlate}
                      </span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        Paid {formatCurrency(confirmedPass.totalPaid, confirmedPass.currency)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 leading-relaxed">
                  <strong className="text-slate-900 font-semibold">Arrival directions:</strong>{' '}
                  {confirmedPass.entryInstructions}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onGoToPasses();
                  }}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Open My Passes
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-4 border border-slate-200 hover:bg-slate-50 text-slate-800 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Back to Map
                </button>
              </div>
            </div>
          ) : (
            <div className="pb-6">
              <div className="relative h-48 bg-slate-100 overflow-hidden">
                {!imgFailed ? (
                  <img
                    src={facility.imageUrl}
                    alt={`${facility.name} interior`}
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-500">
                    <Car className="w-10 h-10" aria-hidden="true" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent" />
                <div className="absolute bottom-3.5 left-5 right-5 text-white flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs text-slate-200">
                      <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        {facility.address} · {walkMinutes} min walk ({distLabel})
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-xl font-bold tabular-nums">
                      {formatCurrency(total, facility.currency)}
                    </span>
                    <span className="block text-[11px] text-slate-200">
                      {formatDurationLabel(durationHours)} total
                    </span>
                  </div>
                </div>
              </div>

              {!compatible && (
                <div className="mx-5 mt-4 p-3.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <strong className="font-semibold">Vehicle height notice:</strong> Maximum clearance is{' '}
                    {facility.clearanceLabel}, which may be restrictive for {VEHICLE_LABELS[search.vehicleSize]}.
                  </div>
                </div>
              )}

              <div className="px-5 py-4 border-b border-slate-200 space-y-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-700">
                  <span className="font-semibold text-slate-900">{facility.accessHours}</span>
                  <span aria-hidden="true">·</span>
                  <span>Clearance {facility.clearanceLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {facility.amenities.map((a) => AMENITY_LABELS[a]).join(' · ')}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {facility.entryInstructions}
                </p>
                <div className="flex items-center gap-4 text-xs text-emerald-700 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    {facility.cancellationPolicy}
                  </span>
                </div>
              </div>

              <div className="px-5 py-4 border-b border-slate-200">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Choose Your Parking Bay
                    </h3>
                    <p className="text-xs text-slate-500">
                      Pick an open stall on Level P1 or P2 before arrival
                    </p>
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    {(['P1', 'P2'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setSelectedLevel(lvl)}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                          selectedLevel === lvl
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Level {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-medium text-slate-700">
                      Elevator &amp; Exit Stairwell Core (North)
                    </span>
                    <span className="font-mono">Gate Entry Lane</span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {levelBays.map((bay) => {
                      const isAvailable = bay.status === 'available';
                      const isPicked = selectedBayId === bay.id;
                      return (
                        <button
                          key={bay.id}
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => setSelectedBayId(bay.id)}
                          className={`p-2 rounded-lg border text-left transition-all flex flex-col justify-between min-h-[64px] ${
                            !isAvailable
                              ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                              : isPicked
                              ? 'bg-blue-600 border-blue-700 text-white shadow-sm cursor-pointer'
                              : 'bg-white border-slate-300 text-slate-900 hover:border-blue-500 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-xs font-bold tabular-nums">
                              {bay.code}
                            </span>
                            {bay.type === 'ev' && (
                              <Zap
                                className={`w-3 h-3 shrink-0 ${
                                  isPicked ? 'text-emerald-200' : 'text-emerald-600'
                                }`}
                                aria-label="EV charger"
                              />
                            )}
                            {bay.type === 'accessible' && (
                              <Accessibility
                                className={`w-3 h-3 shrink-0 ${
                                  isPicked ? 'text-blue-100' : 'text-blue-600'
                                }`}
                                aria-label="Accessible bay"
                              />
                            )}
                          </div>
                          <div
                            className={`text-[10px] leading-tight mt-1 ${
                              !isAvailable
                                ? 'text-slate-400'
                                : isPicked
                                ? 'text-blue-100'
                                : 'text-slate-500'
                            }`}
                          >
                            {!isAvailable
                              ? 'Occupied'
                              : bay.type === 'ev'
                              ? `${bay.chargerKw ?? 11}kW EV`
                              : bay.nearElevator
                              ? 'Near Lift'
                              : bay.type === 'oversized'
                              ? 'Wide Bay'
                              : 'Open'}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-white border border-slate-300" />
                      Open
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-blue-600" />
                      Selected
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-slate-200" />
                      Occupied
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Zap className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                      EV Charging
                    </span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleBook} className="px-5 pt-4 space-y-4">
                <div className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                    {formatShortTime(search.entryIso)} → {formatShortTime(search.exitIso)}
                  </span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {selectedBay ? `${selectedBay.level} · Bay ${selectedBay.code}` : 'Select bay'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="driver-name" className="block text-xs font-medium text-slate-700 mb-1">
                      Driver Name
                    </label>
                    <input
                      id="driver-name"
                      type="text"
                      required
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label htmlFor="driver-email" className="block text-xs font-medium text-slate-700 mb-1">
                      Pass Receipt Email
                    </label>
                    <input
                      id="driver-email"
                      type="email"
                      required
                      value={driverEmail}
                      onChange={(e) => setDriverEmail(e.target.value)}
                      className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label htmlFor="license-plate" className="block text-xs font-medium text-slate-700 mb-1">
                      Vehicle Number / Plate
                    </label>
                    <input
                      id="license-plate"
                      type="text"
                      required
                      value={licensePlate}
                      onChange={(e) => setLicensePlate(e.target.value)}
                      className="w-full h-10 px-3 text-sm font-mono uppercase bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label htmlFor="vehicle-model" className="block text-xs font-medium text-slate-700 mb-1">
                      Vehicle Make &amp; Model
                    </label>
                    <input
                      id="vehicle-model"
                      type="text"
                      value={vehicleModel}
                      onChange={(e) => setVehicleModel(e.target.value)}
                      className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Parking ({formatDurationLabel(durationHours)})</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(subtotal, facility.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Reservation &amp; gate service fee</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(serviceFee, facility.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 text-base pt-1.5 border-t border-slate-100">
                    <span>Total Due</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(total, facility.currency)}
                    </span>
                  </div>
                </div>

                {formError && (
                  <p role="alert" className="text-xs font-medium text-red-600">
                    {formError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Confirm &amp; Issue Pass — {formatCurrency(total, facility.currency)}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
