import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type Request, type Response, type NextFunction } from 'express';
import { MongoClient, type Collection, type Document } from 'mongodb';
import { createServer as createViteServer } from 'vite';
import {
  GARAGE_IMAGES,
  INITIAL_SAMPLE_RESERVATIONS,
  PARKING_FACILITIES,
} from './src/data/parkingData.ts';
import type {
  AuthUser,
  ParkingFacility,
  Reservation,
  UserRole,
} from './src/types/parking.ts';

interface StoredAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  salt: string;
  passwordHash: string;
  defaultPlate?: string;
  defaultVehicle?: string;
}

interface PersistedDatabase {
  tokenSecret: string;
  accounts: StoredAccount[];
  facilities: ParkingFacility[];
  reservations: Reservation[];
}

interface AppMetadata extends Document {
  key: string;
  value: string;
}

interface AuthedRequest extends Request {
  authUser?: AuthUser;
}

const PORT = Number(process.env.PORT) || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/curbgrid';
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'curbgrid-db.json');

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password: string, salt: string, expectedHex: string): boolean {
  const actual = Buffer.from(hashPassword(password, salt), 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

const accounts = new Map<string, StoredAccount>();
let facilitiesStore: ParkingFacility[] = [];
let reservationsStore: Reservation[] = [];
let TOKEN_SECRET = process.env.SESSION_SECRET || '';
let accountsCollection: Collection<StoredAccount>;
let facilitiesCollection: Collection<ParkingFacility>;
let reservationsCollection: Collection<Reservation>;
let metadataCollection: Collection<AppMetadata>;

function createSeedAccount(
  id: string,
  name: string,
  email: string,
  password: string,
  role: UserRole,
  defaultPlate?: string,
  defaultVehicle?: string
): StoredAccount {
  const salt = crypto.randomBytes(16).toString('hex');
  return {
    id,
    name,
    email: email.toLowerCase(),
    role,
    salt,
    passwordHash: hashPassword(password, salt),
    defaultPlate,
    defaultVehicle,
  };
}

async function saveDatabase() {
  await Promise.all([
    ...Array.from(accounts.values(), (account) =>
      accountsCollection.updateOne(
        { id: account.id },
        { $set: account },
        { upsert: true }
      )
    ),
    ...facilitiesStore.map((facility) =>
      facilitiesCollection.updateOne(
        { id: facility.id },
        { $set: facility },
        { upsert: true }
      )
    ),
    ...reservationsStore.map((reservation) =>
      reservationsCollection.updateOne(
        { id: reservation.id },
        { $set: reservation },
        { upsert: true }
      )
    ),
    metadataCollection.updateOne(
      { key: 'tokenSecret' },
      { $set: { key: 'tokenSecret', value: TOKEN_SECRET } },
      { upsert: true }
    ),
  ]);
}

async function initializeDatabase() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();

  accountsCollection = db.collection<StoredAccount>('accounts');
  facilitiesCollection = db.collection<ParkingFacility>('facilities');
  reservationsCollection = db.collection<Reservation>('reservations');
  metadataCollection = db.collection<AppMetadata>('app_metadata');

  await Promise.all([
    accountsCollection.createIndex({ id: 1 }, { unique: true }),
    accountsCollection.createIndex({ email: 1 }, { unique: true }),
    facilitiesCollection.createIndex({ id: 1 }, { unique: true }),
    reservationsCollection.createIndex({ id: 1 }, { unique: true }),
  ]);

  let legacyData: Partial<PersistedDatabase> = {};
  if (fs.existsSync(DB_PATH)) {
    try {
      legacyData = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) as Partial<PersistedDatabase>;
    } catch (error) {
      throw new Error(`Could not read the existing JSON database at ${DB_PATH}.`, { cause: error });
    }
  }

  const [storedAccounts, storedFacilities, storedReservations, tokenRecord] =
    await Promise.all([
      accountsCollection.find({}, { projection: { _id: 0 } }).toArray(),
      facilitiesCollection.find({}, { projection: { _id: 0 } }).toArray(),
      reservationsCollection.find({}, { projection: { _id: 0 } }).toArray(),
      metadataCollection.findOne({ key: 'tokenSecret' }),
    ]);

  TOKEN_SECRET =
    process.env.SESSION_SECRET ||
    legacyData.tokenSecret ||
    tokenRecord?.value ||
    crypto.randomBytes(32).toString('hex');

  if (storedAccounts.length > 0) {
    for (const account of storedAccounts) {
      accounts.set(account.email.toLowerCase(), account);
    }
    facilitiesStore =
      storedFacilities.length > 0
        ? storedFacilities
        : legacyData.facilities || JSON.parse(JSON.stringify(PARKING_FACILITIES));
    reservationsStore =
      storedReservations.length > 0 || !legacyData.reservations
        ? storedReservations
        : legacyData.reservations;
  } else if (legacyData.accounts?.length) {
    for (const account of legacyData.accounts) {
      accounts.set(account.email.toLowerCase(), account);
    }
    facilitiesStore =
      legacyData.facilities || JSON.parse(JSON.stringify(PARKING_FACILITIES));
    reservationsStore = legacyData.reservations || [];
  } else {
    const seededDriver = createSeedAccount(
      'usr-driver-1',
      'Jordan Taylor',
      'driver@curbgrid.app',
      'DriverPass2026!',
      'user',
      'TS 03 EK 4821',
      'Hyundai Ioniq 5'
    );
    const seededAdmin = createSeedAccount(
      'usr-admin-1',
      'Morgan Vance',
      'admin@curbgrid.app',
      'AdminOps2026!',
      'admin',
      'OPS-001',
      'Fleet Supervisor'
    );
    accounts.set(seededDriver.email, seededDriver);
    accounts.set(seededAdmin.email, seededAdmin);
    facilitiesStore = JSON.parse(JSON.stringify(PARKING_FACILITIES));
    reservationsStore = INITIAL_SAMPLE_RESERVATIONS.map((reservation) => ({
      ...reservation,
      userId: 'usr-driver-1',
      driverName: 'Jordan Taylor',
      driverEmail: 'driver@curbgrid.app',
    }));
  }

  await saveDatabase();
  console.log(`Connected to MongoDB database "${db.databaseName}".`);
}

function signToken(user: AuthUser): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    })
  ).toString('base64url');

  const sig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token: string): { sub: string; email: string; role: UserRole } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(payload)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded || typeof decoded.exp !== 'number' || decoded.exp < Date.now()) {
      return null;
    }
    return { sub: decoded.sub, email: decoded.email, role: decoded.role };
  } catch {
    return null;
  }
}

function toPublicUser(acc: StoredAccount): AuthUser {
  return {
    id: acc.id,
    name: acc.name,
    email: acc.email,
    role: acc.role,
    defaultPlate: acc.defaultPlate,
    defaultVehicle: acc.defaultVehicle,
  };
}

function attachAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim();
    const verified = verifyToken(token);
    if (verified) {
      const account = accounts.get(verified.email.toLowerCase());
      if (account) {
        req.authUser = toPublicUser(account);
      }
    }
  }
  next();
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    res.status(401).json({ error: 'Administrator sign-in required.' });
    return;
  }
  if (req.authUser.role !== 'admin') {
    res.status(403).json({ error: 'Administrator privileges required for this action.' });
    return;
  }
  next();
}

async function startServer() {
  await initializeDatabase();
  const app = express();
  app.use(express.json());
  app.use(attachAuth);

  // Auth: Register new driver account (persisted to MongoDB)
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    const { name, email, password, defaultPlate, defaultVehicle } = req.body ?? {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(name || '').trim();
    const cleanPassword = String(password || '');

    if (!cleanName || !cleanEmail.includes('@') || cleanPassword.length < 6) {
      res.status(400).json({
        error: 'Full name, valid email address, and a password of at least 6 characters are required.',
      });
      return;
    }

    if (accounts.has(cleanEmail)) {
      res.status(409).json({
        error: 'An account with this email already exists. Please sign in instead.',
      });
      return;
    }

    const id = `usr-${crypto.randomUUID().slice(0, 8)}`;
    const newAccount = createSeedAccount(
      id,
      cleanName,
      cleanEmail,
      cleanPassword,
      'user',
      defaultPlate ? String(defaultPlate).trim().toUpperCase() : undefined,
      defaultVehicle ? String(defaultVehicle).trim() : undefined
    );

    accounts.set(cleanEmail, newAccount);
    await saveDatabase();

    const user = toPublicUser(newAccount);
    const token = signToken(user);
    res.status(201).json({ user, token });
  });

  // Auth: Login for User or Admin portal
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password, portalRole } = req.body ?? {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || '');
    const expectedRole: UserRole = portalRole === 'admin' ? 'admin' : 'user';

    const account = accounts.get(cleanEmail);
    if (!account || !verifyPassword(cleanPassword, account.salt, account.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (account.role !== expectedRole) {
      if (expectedRole === 'admin') {
        res.status(403).json({
          error:
            'This account has Driver access only. Please sign in through the User Login page or use an Administrator account.',
        });
      } else {
        res.status(403).json({
          error:
            'This is an Administrator account. Please sign in through the Admin Portal Login page.',
        });
      }
      return;
    }

    const user = toPublicUser(account);
    const token = signToken(user);
    res.json({ user, token });
  });

  // Auth: Current session profile
  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res: Response) => {
    res.json({ user: req.authUser });
  });

  // Authenticated: List facilities
  app.get('/api/facilities', requireAuth, (_req: Request, res: Response) => {
    res.json({ facilities: facilitiesStore });
  });

  // Reservations: List (User gets own reservations; Admin gets all)
  app.get('/api/reservations', requireAuth, (req: AuthedRequest, res: Response) => {
    if (req.authUser!.role === 'admin') {
      res.json({ reservations: reservationsStore });
      return;
    }
    const mine = reservationsStore.filter(
      (r) =>
        r.userId === req.authUser?.id ||
        r.driverEmail.toLowerCase() === req.authUser?.email.toLowerCase()
    );
    res.json({ reservations: mine });
  });

  // Reservations: Create new pass (and save plate/vehicle defaults to user account)
  app.post('/api/reservations', requireAuth, async (req: AuthedRequest, res: Response) => {
    const body = req.body as Reservation | undefined;
    if (!body || !body.facilityId || !body.passCode) {
      res.status(400).json({ error: 'Invalid reservation payload.' });
      return;
    }

    const created: Reservation = {
      ...body,
      userId: req.authUser!.id,
      driverEmail: body.driverEmail || req.authUser!.email,
      createdAt: new Date().toISOString(),
    };
    reservationsStore = [created, ...reservationsStore];

    const account = accounts.get(req.authUser!.email.toLowerCase());
    if (account) {
      if (!account.defaultPlate && body.licensePlate) {
        account.defaultPlate = body.licensePlate.trim().toUpperCase();
      }
      if (!account.defaultVehicle && body.vehicleModel) {
        account.defaultVehicle = body.vehicleModel.trim();
      }
    }

    await saveDatabase();
    res.status(201).json({ reservation: created });
  });

  // Reservations: Extend or cancel
  app.patch('/api/reservations/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { action } = req.body ?? {};
    const existing = reservationsStore.find((r) => r.id === id);

    if (!existing) {
      res.status(404).json({ error: 'Reservation not found.' });
      return;
    }

    if (
      req.authUser!.role !== 'admin' &&
      existing.userId !== req.authUser!.id &&
      existing.driverEmail.toLowerCase() !== req.authUser!.email.toLowerCase()
    ) {
      res.status(403).json({ error: 'You do not have permission to modify this pass.' });
      return;
    }

    if (action === 'cancel') {
      reservationsStore = reservationsStore.map((r) =>
        r.id === id ? { ...r, status: 'cancelled' } : r
      );
    } else if (action === 'extend') {
      const fac = facilitiesStore.find((f) => f.id === existing.facilityId);
      const hourlyAdd = fac ? fac.hourlyRate : existing.currency === 'INR' ? 35 : 5;
      const currentExit = new Date(existing.exitIso);
      const nextExit = new Date(currentExit.getTime() + 60 * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      const nextExitIso = `${nextExit.getFullYear()}-${pad(nextExit.getMonth() + 1)}-${pad(nextExit.getDate())}T${pad(nextExit.getHours())}:${pad(nextExit.getMinutes())}`;

      reservationsStore = reservationsStore.map((r) =>
        r.id === id
          ? {
              ...r,
              exitIso: nextExitIso,
              subtotal: Math.round((r.subtotal + hourlyAdd) * 100) / 100,
              totalPaid: Math.round((r.totalPaid + hourlyAdd) * 100) / 100,
            }
          : r
      );
    }

    await saveDatabase();
    const updated = reservationsStore.find((r) => r.id === id);
    res.json({ reservation: updated });
  });

  // Admin: List registered user and admin accounts (public fields only)
  app.get('/api/admin/users', requireAdmin, (_req: AuthedRequest, res: Response) => {
    const users = Array.from(accounts.values()).map(toPublicUser);
    res.json({ users });
  });

  // Admin: Create new driver or administrator account
  app.post('/api/admin/users', requireAdmin, async (req: AuthedRequest, res: Response) => {
    const { name, email, password, role, defaultPlate, defaultVehicle } = req.body ?? {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(name || '').trim();
    const cleanPassword = String(password || '');
    const assignedRole: UserRole = role === 'admin' ? 'admin' : 'user';

    if (!cleanName || !cleanEmail.includes('@') || cleanPassword.length < 6) {
      res.status(400).json({
        error: 'Name, valid email, and password (min 6 characters) are required.',
      });
      return;
    }

    if (accounts.has(cleanEmail)) {
      res.status(409).json({
        error: 'An account with this email already exists.',
      });
      return;
    }

    const id = `usr-${crypto.randomUUID().slice(0, 8)}`;
    const newAccount = createSeedAccount(
      id,
      cleanName,
      cleanEmail,
      cleanPassword,
      assignedRole,
      defaultPlate ? String(defaultPlate).trim().toUpperCase() : undefined,
      defaultVehicle ? String(defaultVehicle).trim() : undefined
    );

    accounts.set(cleanEmail, newAccount);
    await saveDatabase();
    res.status(201).json({ user: toPublicUser(newAccount) });
  });

  // Admin: Update facility rate, capacity, or access hours
  app.patch(
    '/api/admin/facilities/:id',
    requireAdmin,
    async (req: AuthedRequest, res: Response) => {
      const { id } = req.params;
      const { hourlyRate, dailyMaxRate, availableSpots, accessHours } = req.body ?? {};
      const idx = facilitiesStore.findIndex((f) => f.id === id);
      if (idx === -1) {
        res.status(404).json({ error: 'Facility not found.' });
        return;
      }

      const current = facilitiesStore[idx];
      const nextAvailable =
        typeof availableSpots === 'number'
          ? Math.max(0, Math.min(current.totalSpots, Math.round(availableSpots)))
          : current.availableSpots;

      const updatedBays = current.bays.map((bay, bayIdx) => ({
        ...bay,
        status: bayIdx < nextAvailable ? ('available' as const) : ('occupied' as const),
      }));

      const updated: ParkingFacility = {
        ...current,
        hourlyRate:
          typeof hourlyRate === 'number' && hourlyRate > 0
            ? Math.round(hourlyRate * 100) / 100
            : current.hourlyRate,
        dailyMaxRate:
          typeof dailyMaxRate === 'number' && dailyMaxRate > 0
            ? Math.round(dailyMaxRate * 100) / 100
            : current.dailyMaxRate,
        availableSpots: nextAvailable,
        accessHours:
          typeof accessHours === 'string' && accessHours.trim()
            ? accessHours.trim()
            : current.accessHours,
        bays: updatedBays,
      };

      facilitiesStore[idx] = updated;
      await saveDatabase();
      res.json({ facility: updated });
    }
  );

  // Admin: Add new parking facility to live map
  app.post('/api/admin/facilities', requireAdmin, async (req: AuthedRequest, res: Response) => {
    const {
      cityId,
      name,
      address,
      district,
      hourlyRate,
      dailyMaxRate,
      clearanceLabel,
      facilityType,
      mapX,
      mapY,
    } = req.body ?? {};

    if (!name || !address) {
      res.status(400).json({ error: 'Facility name and street address are required.' });
      return;
    }

    const resolvedCityId =
      cityId === 'hyderabad' || cityId === 'bengaluru' || cityId === 'chicago'
        ? cityId
        : 'warangal';
    const currency = resolvedCityId === 'chicago' ? 'USD' : 'INR';
    const baseRate = Math.max(2, Number(hourlyRate) || (currency === 'INR' ? 35 : 4.5));
    const maxRate = Math.max(baseRate * 2, Number(dailyMaxRate) || (currency === 'INR' ? 160 : 20));
    const newId = `fac-custom-${Date.now()}`;

    const baseFac = facilitiesStore[0];
    const newFacility: ParkingFacility = {
      id: newId,
      cityId: resolvedCityId,
      currency,
      name: String(name).trim(),
      operator: 'CurbGrid Partner Ops',
      address: String(address).trim(),
      district: String(district || 'Hanamkonda, Warangal').trim(),
      mapX: Math.max(60, Math.min(920, Number(mapX) || 520)),
      mapY: Math.max(60, Math.min(640, Number(mapY) || 340)),
      hourlyRate: baseRate,
      dailyMaxRate: maxRate,
      monthlyWeekdayRate: Math.round(maxRate * 10),
      monthlyUnlimitedRate: Math.round(maxRate * 13),
      clearanceInches: 84,
      clearanceLabel: String(clearanceLabel || "7'0\""),
      rating: 4.8,
      reviewCount: 1,
      availableSpots: 10,
      totalSpots: 16,
      amenities: ['covered', 'self_park', 'access_24_7'],
      facilityType: facilityType || 'Garage',
      imageUrl: GARAGE_IMAGES.modernConcrete,
      entryInstructions: `Enter at ${String(address).trim()} and scan your CurbGrid QR pass at the barrier kiosk.`,
      accessHours: 'Open 24/7',
      cancellationPolicy: 'Free cancellation up to 1 hr before entry',
      evChargersCount: 4,
      bays: baseFac.bays.map((b, i) => ({
        ...b,
        id: `${newId}-${b.code}`,
        status: i < 10 ? 'available' : 'occupied',
      })),
    };

    facilitiesStore = [newFacility, ...facilitiesStore];
    await saveDatabase();
    res.status(201).json({ facility: newFacility });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      try {
        const template = fs.readFileSync(
          path.resolve(process.cwd(), 'index.html'),
          'utf-8'
        );
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) {
        next(err);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CurbGrid server listening on http://localhost:${PORT}`);
    console.log('Persistent backend store ready in MongoDB.');
  });
}

startServer().catch((error: unknown) => {
  console.error('Could not start CurbGrid. Verify that MongoDB is running and MONGODB_URI is correct.', error);
  process.exitCode = 1;
});
