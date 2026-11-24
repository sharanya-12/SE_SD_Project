export type VehicleSize = 'sedan' | 'suv' | 'oversized' | 'motorcycle';

export type CityId = 'warangal' | 'hyderabad' | 'bengaluru' | 'chicago' | 'custom';

export type CurrencyCode = 'INR' | 'USD';

export type AmenityType =
  | 'covered'
  | 'ev_charging'
  | 'valet'
  | 'access_24_7'
  | 'self_park'
  | 'in_out'
  | 'shuttle';

export type SortOption = 'recommended' | 'price_asc' | 'distance_asc' | 'rating_desc';

export type UserRole = 'user' | 'admin';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  defaultPlate?: string;
  defaultVehicle?: string;
}

export type AppView =
  | 'finder'
  | 'monthly'
  | 'venues'
  | 'how_it_works'
  | 'passes'
  | 'user_login'
  | 'admin_login'
  | 'admin_dashboard';

export interface ParkingBay {
  id: string;
  code: string;
  level: 'P1' | 'P2';
  zone: string;
  type: 'standard' | 'ev' | 'compact' | 'accessible' | 'oversized';
  status: 'available' | 'occupied' | 'reserved';
  nearElevator?: boolean;
  chargerKw?: number;
}

export interface ParkingFacility {
  id: string;
  cityId: CityId;
  currency: CurrencyCode;
  name: string;
  operator: string;
  address: string;
  district: string;
  /** Map coordinate X (0 to 1000) */
  mapX: number;
  /** Map coordinate Y (0 to 700) */
  mapY: number;
  hourlyRate: number;
  dailyMaxRate: number;
  monthlyWeekdayRate: number;
  monthlyUnlimitedRate: number;
  clearanceInches: number; // e.g., 82 inches = 6'10"
  clearanceLabel: string;
  rating: number;
  reviewCount: number;
  availableSpots: number;
  totalSpots: number;
  amenities: AmenityType[];
  facilityType: 'Garage' | 'Surface Lot' | 'Valet Garage' | 'Airport Deck';
  imageUrl: string;
  entryInstructions: string;
  accessHours: string;
  cancellationPolicy: string;
  evChargersCount: number;
  bays: ParkingBay[];
}

export interface DestinationPreset {
  id: string;
  cityId: CityId;
  cityLabel: string;
  currency: CurrencyCode;
  name: string;
  subtitle: string;
  category: 'Neighborhood' | 'Transit Hub' | 'Airport' | 'Venue';
  mapX: number;
  mapY: number;
  description: string;
  defaultDurationHours: number;
}

export interface CityMapConfig {
  id: CityId;
  label: string;
  country: string;
  currency: CurrencyCode;
  waterLabel: string;
  parkLabel: string;
  eastWestStreets: Array<{ y: number; name: string }>;
  northSouthAvenues: Array<{ x: number; name: string }>;
  districtLabels: Array<{ x: number; y: number; name: string }>;
}

export interface SearchState {
  query: string;
  destinationId: string;
  entryIso: string; // YYYY-MM-DDTHH:mm
  exitIso: string;  // YYYY-MM-DDTHH:mm
  vehicleSize: VehicleSize;
  activeFilter: 'all' | AmenityType;
  sortBy: SortOption;
}

export interface Reservation {
  id: string;
  userId?: string;
  currency: CurrencyCode;
  passCode: string;
  facilityId: string;
  facilityName: string;
  facilityAddress: string;
  facilityType: string;
  entryIso: string;
  exitIso: string;
  bayCode: string;
  bayLevel: string;
  vehicleSize: VehicleSize;
  licensePlate: string;
  vehicleModel: string;
  driverName: string;
  driverEmail: string;
  subtotal: number;
  serviceFee: number;
  totalPaid: number;
  status: 'active' | 'upcoming' | 'cancelled' | 'monthly';
  createdAt: string;
  entryInstructions: string;
  isMonthly?: boolean;
  monthlyTier?: 'weekday' | 'unlimited';
}
