import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  Crosshair,
  Navigation,
  Play,
  Square,
  Star,
  X,
  Zap,
} from 'lucide-react';
import { CityId, DestinationPreset, ParkingFacility, VehicleSize } from '../types/parking';
import {
  CITY_MAPS,
  calculateFacilityPrice,
  formatCurrency,
  getDistanceMiles,
} from '../data/parkingData';

interface ParkingMapProps {
  facilities: ParkingFacility[];
  destination: DestinationPreset;
  destinationSelected: boolean;
  durationHours: number;
  vehicleSize: VehicleSize;
  selectedFacilityId: string | null;
  hoveredFacilityId: string | null;
  onSelectFacility: (facility: ParkingFacility) => void;
  onHoverFacility: (facilityId: string | null) => void;
  onInspectFacility: (facility: ParkingFacility) => void;
}

type Coordinates = { lat: number; lng: number };
type MapStatus = { message: string; error: boolean } | null;
type MapDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
};
type RouteStep = { instruction: string; road: string; distance: number; location: Coordinates };

const formatRouteDistance = (meters: number) =>
  meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;

const getDistanceMeters = (from: Coordinates, to: Coordinates) => {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latDelta = radians(to.lat - from.lat);
  const lngDelta = radians(to.lng - from.lng);
  const value =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(radians(from.lat)) *
      Math.cos(radians(to.lat)) *
      Math.sin(lngDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const getStepInstruction = (maneuver: { type: string; modifier?: string; exit?: number }) => {
  if (maneuver.type === 'depart') return 'Start';
  if (maneuver.type === 'arrive') return 'Arrive at destination';
  if (maneuver.type === 'roundabout' || maneuver.type === 'rotary') {
    return maneuver.exit ? `At roundabout, take exit ${maneuver.exit}` : 'At roundabout, take the indicated exit';
  }

  const direction = maneuver.modifier?.replace(/_/g, ' ');
  if (maneuver.type === 'turn') return `Turn ${direction || 'ahead'}`;
  if (maneuver.type === 'continue') return `Continue ${direction || 'straight'}`;
  if (maneuver.type === 'merge') return `Merge ${direction || 'ahead'}`;
  if (maneuver.type === 'on ramp') return 'Take the ramp';
  if (maneuver.type === 'off ramp') return 'Take the exit ramp';
  if (maneuver.type === 'fork') return `Keep ${direction || 'straight'}`;
  if (maneuver.type === 'end of road') return `At the end of the road, turn ${direction || 'ahead'}`;

  const description = maneuver.type.replace(/_/g, ' ');
  return description.charAt(0).toUpperCase() + description.slice(1);
};

const CITY_CENTERS: Record<CityId, Coordinates> = {
  warangal: { lat: 17.9784, lng: 79.6000 },
  hyderabad: { lat: 17.3850, lng: 78.4867 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  chicago: { lat: 41.8781, lng: -87.6298 },
  custom: { lat: 17.9784, lng: 79.6000 },
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });

const createPinIcon = (label: string, selected: boolean) =>
  L.divIcon({
    className: 'curbgrid-map-pin',
    html: `<span class="curbgrid-map-pin__label${selected ? ' curbgrid-map-pin__label--selected' : ''}">${escapeHtml(label)}</span>`,
    iconSize: [1, 1],
    iconAnchor: [0, 0],
  });

const getFacilityCoordinates = (facility: ParkingFacility): Coordinates => {
  const center = CITY_CENTERS[facility.cityId];
  return {
    lat: center.lat + (350 - facility.mapY) * 0.000035,
    lng: center.lng + (facility.mapX - 500) * 0.000035,
  };
};

export const ParkingMap: React.FC<ParkingMapProps> = ({
  facilities,
  destination,
  destinationSelected,
  durationHours,
  vehicleSize,
  selectedFacilityId,
  hoveredFacilityId,
  onSelectFacility,
  onHoverFacility,
  onInspectFacility,
}) => {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const facilityLayerRef = useRef<L.LayerGroup | null>(null);
  const destinationLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const markerHandlersRef = useRef({ onSelectFacility, onHoverFacility });
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [routeOrigin, setRouteOrigin] = useState<Coordinates | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<Coordinates | null>(null);
  const [mapStatus, setMapStatus] = useState<MapStatus>(null);
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const [directionsOpen, setDirectionsOpen] = useState(true);
  const [isMapDragging, setIsMapDragging] = useState(false);
  const activeStepIndexRef = useRef(0);
  const routeStepsRef = useRef(routeSteps);
  const mapDragRef = useRef<MapDrag | null>(null);
  const suppressMapClickRef = useRef(false);
  const [locationRequest, setLocationRequest] = useState(0);

  const cityMap = CITY_MAPS[destination.cityId] || CITY_MAPS.warangal;
  const activeFacility =
    facilities.find((facility) => facility.id === selectedFacilityId) ||
    facilities.find((facility) => facility.id === hoveredFacilityId) ||
    null;

  markerHandlersRef.current = { onSelectFacility, onHoverFacility };
  routeStepsRef.current = routeSteps;

  const startMarkerDrag = (event: L.LeafletMouseEvent) => {
    const pointer = event.originalEvent;
    if (pointer.button !== 0) return;
    mapDragRef.current = {
      pointerId: -1,
      startX: pointer.clientX,
      startY: pointer.clientY,
      lastX: pointer.clientX,
      lastY: pointer.clientY,
      moved: false,
    };
  };
  const startMarkerDragRef = useRef(startMarkerDrag);
  startMarkerDragRef.current = startMarkerDrag;

  const beginPointerDrag = (event: PointerEvent) => {
    if (event.button !== 0 && event.pointerType !== 'touch') return;
    if (event.target instanceof Element && event.target.closest('.leaflet-control')) return;
    mapDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
    };
  };
  const beginPointerDragRef = useRef(beginPointerDrag);
  beginPointerDragRef.current = beginPointerDrag;
  const markerPointerDownHandlerRef = useRef<EventListener>((event) => {
    if (event instanceof PointerEvent) beginPointerDragRef.current(event);
  });

  useEffect(() => {
    const mapElement = mapElementRef.current;
    if (!mapElement || mapRef.current) return;

    const map = L.map(mapElement, {
      center: [CITY_CENTERS[destination.cityId].lat, CITY_CENTERS[destination.cityId].lng],
      zoom: 13,
      dragging: false,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    const handlePointerDown = (event: PointerEvent) => beginPointerDragRef.current(event);

    const handleClickCapture = (event: MouseEvent) => {
      if (!suppressMapClickRef.current) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressMapClickRef.current = false;
    };

    mapElement.addEventListener('pointerdown', handlePointerDown, true);
    mapElement.addEventListener('click', handleClickCapture, true);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    facilityLayerRef.current = L.layerGroup().addTo(map);
    destinationLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const handlePointerMove = (event: PointerEvent) => {
      const drag = mapDragRef.current;
      if (!drag || (drag.pointerId !== -1 && drag.pointerId !== event.pointerId)) return;

      const totalX = event.clientX - drag.startX;
      const totalY = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(totalX, totalY) < 4) return;

      drag.moved = true;
      setIsMapDragging(true);
      setAutoFollow(false);
      map.panBy(
        [drag.lastX - event.clientX, drag.lastY - event.clientY],
        { animate: false }
      );
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      event.preventDefault();
    };

    const handlePointerUp = (event: PointerEvent) => {
      const drag = mapDragRef.current;
      if (!drag || (drag.pointerId !== -1 && drag.pointerId !== event.pointerId)) return;
      if (drag.moved) {
        suppressMapClickRef.current = true;
        window.setTimeout(() => {
          suppressMapClickRef.current = false;
        }, 250);
      }
      mapDragRef.current = null;
      setIsMapDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(mapElement);

    return () => {
      mapElement.removeEventListener('pointerdown', handlePointerDown, true);
      mapElement.removeEventListener('click', handleClickCapture, true);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = facilityLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    facilities.forEach((facility) => {
      const { total } = calculateFacilityPrice(facility, durationHours, vehicleSize);
      const price = formatCurrency(total, facility.currency, 0);
      const marker = L.marker(
        [getFacilityCoordinates(facility).lat, getFacilityCoordinates(facility).lng],
        {
          icon: createPinIcon(price, facility.id === selectedFacilityId),
          keyboard: true,
          title: `${facility.name} - ${price}`,
          bubblingMouseEvents: true,
        }
      );
      marker.bindTooltip(escapeHtml(facility.name), { direction: 'top', offset: [0, -8] });
      marker.on('mousedown', (event) => startMarkerDragRef.current(event));
      marker.on('click', () => markerHandlersRef.current.onSelectFacility(facility));
      marker.on('mouseover', () => markerHandlersRef.current.onHoverFacility(facility.id));
      marker.on('mouseout', () => markerHandlersRef.current.onHoverFacility(null));
      layer.addLayer(marker);
      marker.getElement()?.addEventListener('pointerdown', markerPointerDownHandlerRef.current, true);
    });
  }, [
    facilities,
    durationHours,
    vehicleSize,
    selectedFacilityId,
  ]);

  useEffect(() => {
    let cancelled = false;
    const fallback = CITY_CENTERS[destination.cityId];
    setDestinationLocation(null);

    if (!destinationSelected) {
      setMapStatus(null);
      return () => {
        cancelled = true;
      };
    }

    setMapStatus({ message: 'Finding the selected place on the map…', error: false });
    const searchText =
      destination.cityId === 'custom'
        ? destination.name
        : `${destination.name}, ${destination.cityLabel}`;
    const query = encodeURIComponent(searchText);

    fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${query}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Place lookup failed (${response.status}).`);
        return (await response.json()) as Array<{ lat: string; lon: string }>;
      })
      .then((results) => {
        if (cancelled) return;
        if (results.length) {
          setDestinationLocation({ lat: Number(results[0].lat), lng: Number(results[0].lon) });
          setMapStatus(null);
        } else {
          setDestinationLocation(fallback);
          setMapStatus({
            message: 'Could not find that exact place; showing its city center instead.',
            error: true,
          });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setDestinationLocation(fallback);
        setMapStatus({
          message: error instanceof Error ? error.message : 'Place lookup failed.',
          error: true,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [destination, destinationSelected]);

  useEffect(() => {
    if (!destinationSelected || !navigator.geolocation) {
      if (destinationSelected && !navigator.geolocation) {
        setMapStatus({ message: 'This browser does not support current-location access.', error: true });
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(coordinates);
        setRouteOrigin(coordinates);
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? 'Allow location access in your browser to show your position and route.'
            : 'Could not get your current location. Check location services and try again.';
        setMapStatus({ message, error: true });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }, [destinationSelected, locationRequest]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = destinationLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    if (!destinationSelected || !destinationLocation) {
      map.setView(CITY_CENTERS[destination.cityId], 13, { animate: true });
      return;
    }

    const destinationMarker = L.marker([destinationLocation.lat, destinationLocation.lng], {
      icon: L.divIcon({
        className: 'curbgrid-map-destination',
        html: '<span class="curbgrid-map-destination__dot"></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      bubblingMouseEvents: true,
    });
    destinationMarker.on('mousedown', (event) => startMarkerDragRef.current(event));
    layer.addLayer(destinationMarker);
    destinationMarker.getElement()?.addEventListener('pointerdown', markerPointerDownHandlerRef.current, true);

    if (userLocation) {
      const userMarker = L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 8,
        color: '#ffffff',
        weight: 3,
        fillColor: '#2563eb',
        fillOpacity: 1,
        bubblingMouseEvents: true,
      });
      userMarker.on('mousedown', (event) => startMarkerDragRef.current(event));
      layer.addLayer(userMarker);
      userMarker.getElement()?.addEventListener('pointerdown', markerPointerDownHandlerRef.current, true);
      if (isNavigating && autoFollow) {
        map.setView([userLocation.lat, userLocation.lng], 16, { animate: true });
      } else if (!isNavigating) {
        map.fitBounds(
          L.latLngBounds([userLocation, destinationLocation]).pad(0.25),
          { maxZoom: 14, animate: true }
        );
      }
    } else {
      map.setView([destinationLocation.lat, destinationLocation.lng], 15, { animate: true });
    }
  }, [destination, destinationSelected, destinationLocation, userLocation, isNavigating, autoFollow]);

  useEffect(() => {
    const layer = routeLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    setRouteSteps([]);
    activeStepIndexRef.current = 0;
    setActiveStepIndex(0);
    setIsNavigating(false);
    if (!destinationSelected || !routeOrigin || !destinationLocation) return;

    let cancelled = false;
    const routeUrl = `https://router.project-osrm.org/route/v1/driving/${routeOrigin.lng},${routeOrigin.lat};${destinationLocation.lng},${destinationLocation.lat}?overview=full&geometries=geojson&steps=true`;
    fetch(routeUrl)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Route lookup failed (${response.status}).`);
        return (await response.json()) as {
          code: string;
          routes?: Array<{
            geometry: { coordinates: [number, number][] };
            duration: number;
            distance: number;
            legs: Array<{
              steps: Array<{
                name: string;
                distance: number;
                maneuver: {
                  type: string;
                  modifier?: string;
                  exit?: number;
                  location: [number, number];
                };
              }>;
            }>;
          }>;
        };
      })
      .then((result) => {
        if (cancelled) return;
        const route = result.routes?.[0];
        if (result.code !== 'Ok' || !route) {
          setMapStatus({ message: 'No driving route was found between these locations.', error: true });
          return;
        }
        const points = route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as L.LatLngTuple);
        L.polyline(points, { color: '#2563eb', weight: 5, opacity: 0.8 }).addTo(layer);
        setRouteSteps(
          route.legs.flatMap((leg) =>
            leg.steps.map((step) => ({
              instruction: getStepInstruction(step.maneuver),
              road: step.name,
              distance: step.distance,
              location: { lat: step.maneuver.location[1], lng: step.maneuver.location[0] },
            }))
          )
        );
        setDirectionsOpen(true);
        const km = route.distance / 1000;
        const minutes = Math.round(route.duration / 60);
        setMapStatus({
          message: `Driving route · ${km < 1 ? `${Math.round(route.distance)} m` : `${km.toFixed(1)} km`} · ${minutes} min`,
          error: false,
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMapStatus({
            message: error instanceof Error ? error.message : 'Route lookup failed.',
            error: true,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [destinationSelected, routeOrigin, destinationLocation]);

  useEffect(() => {
    if (!isNavigating || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const currentPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(currentPosition);

        const steps = routeStepsRef.current;
        const currentIndex = activeStepIndexRef.current;
        const nextStep = steps[currentIndex + 1];
        if (nextStep && getDistanceMeters(currentPosition, nextStep.location) <= 35) {
          const nextIndex = currentIndex + 1;
          activeStepIndexRef.current = nextIndex;
          setActiveStepIndex(nextIndex);
        }
      },
      () => {
        setMapStatus({
          message: 'Live GPS updates are unavailable. Use Next step to follow the directions manually.',
          error: true,
        });
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isNavigating]);

  const startNavigation = () => {
    if (routeSteps.length === 0) return;
    activeStepIndexRef.current = 0;
    setActiveStepIndex(0);
    setAutoFollow(true);
    setIsNavigating(true);
    const firstStep = routeSteps[0];
    mapRef.current?.panTo([firstStep.location.lat, firstStep.location.lng], {
      animate: true,
      duration: 0.7,
    });
    setMapStatus({ message: 'Navigation started. Follow the highlighted step.', error: false });
  };

  const focusStep = (index: number) => {
    const step = routeSteps[index];
    if (!step) return;
    activeStepIndexRef.current = index;
    setActiveStepIndex(index);
    mapRef.current?.panTo([step.location.lat, step.location.lng], {
      animate: true,
      duration: 0.7,
    });
  };

  const advanceStep = () => {
    const nextIndex = Math.min(activeStepIndexRef.current + 1, routeSteps.length - 1);
    focusStep(nextIndex);
    if (nextIndex === routeSteps.length - 1) {
      setMapStatus({ message: 'You have reached the destination.', error: false });
    }
  };

  const locateMe = () => {
    if (isNavigating && userLocation) {
      setAutoFollow(true);
      mapRef.current?.setView([userLocation.lat, userLocation.lng], 16, { animate: true });
      return;
    }
    if (!navigator.geolocation) {
      setMapStatus({ message: 'This browser does not support current-location access.', error: true });
      return;
    }
    setLocationRequest((request) => request + 1);
  };

  const panMap = (x: number, y: number) => {
    setAutoFollow(false);
    mapRef.current?.panBy([x, y], { animate: true, duration: 0.35 });
  };

  const recenter = () => {
    const map = mapRef.current;
    if (!map) return;
    if (isNavigating && userLocation) {
      setAutoFollow(true);
      map.setView([userLocation.lat, userLocation.lng], 16, { animate: true });
      return;
    }
    if (destinationSelected && userLocation && destinationLocation) {
      map.fitBounds(L.latLngBounds([userLocation, destinationLocation]).pad(0.25), {
        maxZoom: 14,
        animate: true,
      });
    } else if (destinationSelected && destinationLocation) {
      map.setView([destinationLocation.lat, destinationLocation.lng], 15, { animate: true });
    } else {
      map.setView(CITY_CENTERS[destination.cityId], 13, { animate: true });
    }
  };

  const openFacility = () => {
    if (activeFacility) onInspectFacility(activeFacility);
  };

  return (
    <div className="relative w-full h-full min-h-[420px] overflow-hidden bg-slate-100">
      <div
        ref={mapElementRef}
        className={`absolute inset-0 z-0 touch-none ${isMapDragging ? 'leaflet-dragging' : ''}`}
        aria-label="Interactive street map with parking facilities"
      />

      <div className="absolute top-4 left-14 z-[500] max-w-[min(360px,calc(100%-5rem))] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-1.5 truncate text-xs font-semibold text-slate-900">
          <Navigation className="h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden="true" />
          <span className="truncate">{cityMap.label}, {cityMap.country}</span>
        </div>
        <p className="mt-0.5 truncate text-[11px] leading-snug text-slate-500">
          {destinationSelected ? destination.name : 'Drag, zoom, or select a parking pin'}
        </p>
        <p className="mt-1 text-[10px] leading-snug text-slate-400">
          Click and drag map background to move · Scroll or pinch to zoom
        </p>
        {mapStatus && (
          <p className={`mt-1 text-[11px] ${mapStatus.error ? 'text-amber-700' : 'text-blue-700'}`} role="status">
            {mapStatus.message}
          </p>
        )}
      </div>

      <div className="absolute right-4 top-4 z-[500] flex flex-col gap-2">
        <button
          type="button"
          onClick={locateMe}
          aria-label="Find my current location"
          title="Find my current location"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <Crosshair className="h-4 w-4" />
        </button>
        <div
          role="group"
          aria-label="Move map"
          className="flex flex-col items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-sm"
        >
          <button
            type="button"
            onClick={() => panMap(0, 140)}
            aria-label="Move map up"
            title="Move map up"
            className="flex h-8 w-8 items-center justify-center rounded text-slate-700 hover:bg-slate-100"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <div className="flex gap-0.5">
            <button
              type="button"
              onClick={() => panMap(140, 0)}
              aria-label="Move map left"
              title="Move map left"
              className="flex h-8 w-8 items-center justify-center rounded text-slate-700 hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => panMap(-140, 0)}
              aria-label="Move map right"
              title="Move map right"
              className="flex h-8 w-8 items-center justify-center rounded text-slate-700 hover:bg-slate-100"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => panMap(0, -140)}
            aria-label="Move map down"
            title="Move map down"
            className="flex h-8 w-8 items-center justify-center rounded text-slate-700 hover:bg-slate-100"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={recenter}
          aria-label="Fit map to selected locations"
          title="Fit map to selected locations"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <Navigation className="h-4 w-4" />
        </button>
      </div>

      {activeFacility && (
        <div className="absolute bottom-4 right-4 z-[500] w-80 max-w-[calc(100%-2rem)] rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="truncate text-sm font-semibold text-slate-900">{activeFacility.name}</h4>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {activeFacility.address} · {getDistanceMiles(activeFacility, destination).walkMinutes} min walk
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-mono text-base font-bold tabular-nums text-slate-900">
                {formatCurrency(
                  calculateFacilityPrice(activeFacility, durationHours, vehicleSize).total,
                  activeFacility.currency
                )}
              </div>
              <div className="text-[11px] text-slate-500">total stay</div>
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" aria-hidden="true" />
                {activeFacility.rating.toFixed(1)}
              </span>
              <span aria-hidden="true">·</span>
              <span className={activeFacility.availableSpots <= 3 ? 'font-medium text-amber-700' : 'font-medium text-emerald-700'}>
                {activeFacility.availableSpots} bays open
              </span>
              {activeFacility.evChargersCount > 0 && (
                <Zap className="h-3.5 w-3.5 text-emerald-600" aria-label="EV charging available" />
              )}
            </div>
            <button
              type="button"
              onClick={openFacility}
              className="shrink-0 whitespace-nowrap rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Pick Bay &amp; Reserve
            </button>
          </div>
        </div>
      )}

      {routeSteps.length > 0 && directionsOpen && (
        <section
          aria-label="Turn-by-turn directions"
          className="absolute bottom-12 left-3 z-[500] w-72 max-w-[calc(100%-1.5rem)] overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur-sm"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                <Navigation className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                {isNavigating ? 'Navigation in progress' : 'Driving directions'}
              </h3>
              <p className="pl-5 text-[10px] text-slate-500">
                Step {activeStepIndex + 1} of {routeSteps.length}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (isNavigating) {
                    setIsNavigating(false);
                    setDirectionsOpen(false);
                    setMapStatus({ message: 'Navigation ended.', error: false });
                  } else {
                    startNavigation();
                  }
                }}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-white ${
                  isNavigating ? 'bg-slate-700 hover:bg-slate-800' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isNavigating ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                {isNavigating ? 'End' : 'Start'}
              </button>
              <button
                type="button"
                aria-label={isNavigating ? 'End navigation and close directions' : 'Close directions'}
                title={isNavigating ? 'End navigation and close directions' : 'Close directions'}
                onClick={() => {
                  setIsNavigating(false);
                  setDirectionsOpen(false);
                  if (isNavigating) setMapStatus({ message: 'Navigation ended.', error: false });
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          {isNavigating && (
            <div className="border-b border-blue-100 bg-blue-50 px-3 py-2.5" aria-live="polite">
              <p className="text-sm font-semibold text-blue-950">
                {routeSteps[activeStepIndex]?.instruction}
              </p>
              {routeSteps[activeStepIndex]?.road && (
                <p className="truncate text-xs text-blue-800">{routeSteps[activeStepIndex].road}</p>
              )}
              {activeStepIndex < routeSteps.length - 1 && (
                <button
                  type="button"
                  onClick={advanceStep}
                  className="mt-2 inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-blue-800 hover:bg-blue-100"
                >
                  Next step
                  <ChevronRight className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
          <ol className="max-h-48 divide-y divide-slate-100 overflow-y-auto curb-scroll">
            {routeSteps.map((step, index) => (
              <li
                key={`${index}-${step.instruction}`}
                className={`${
                  isNavigating && index === activeStepIndex ? 'bg-blue-50' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => focusStep(index)}
                  aria-current={isNavigating && index === activeStepIndex ? 'step' : undefined}
                  className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-blue-50"
                >
                  <span className="min-w-0">
                    <span className={`block text-xs font-medium ${isNavigating && index === activeStepIndex ? 'text-blue-800' : 'text-slate-800'}`}>
                      {step.instruction}
                    </span>
                    {step.road && <span className="block truncate text-[11px] text-slate-500">{step.road}</span>}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                    {formatRouteDistance(step.distance)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {routeSteps.length > 0 && !directionsOpen && (
        <button
          type="button"
          onClick={() => setDirectionsOpen(true)}
          className="absolute bottom-12 left-3 z-[500] inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-lg hover:bg-slate-50"
        >
          <Navigation className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
          Show directions
        </button>
      )}

      <div className="absolute bottom-3 left-3 z-[500] rounded bg-white/90 px-2 py-1 text-[10px] text-slate-500 shadow-sm">
        Demo parking pins are approximate. Route lookup shares your location with OSRM.
      </div>
    </div>
  );
};
