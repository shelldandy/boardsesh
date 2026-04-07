'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import MuiButton from '@mui/material/Button';
import MuiTypography from '@mui/material/Typography';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import MapOutlined from '@mui/icons-material/MapOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MyLocationOutlined from '@mui/icons-material/MyLocationOutlined';
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet';
import { useGeolocation } from '@/app/hooks/use-geolocation';

interface MapLocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
}

export default function MapLocationPicker({ latitude, longitude, onChange }: MapLocationPickerProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const { coordinates: userCoords, requestPermission } = useGeolocation();
  const [expanded, setExpanded] = useState(latitude != null && longitude != null);
  const [mapReady, setMapReady] = useState(false);

  const placeMarker = useCallback((lat: number, lng: number) => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      const icon = L.divIcon({
        className: '',
        html: '<div style="width:16px;height:16px;background:#8C4A52;border:3px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      markerRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
      markerRef.current.on('dragend', () => {
        const pos = markerRef.current!.getLatLng();
        onChangeRef.current(
          Math.round(pos.lat * 1000000) / 1000000,
          Math.round(pos.lng * 1000000) / 1000000,
        );
      });
    }
  }, []);

  // Initialize map once the accordion is expanded
  useEffect(() => {
    if (!expanded || !containerRef.current) return;

    // Guard against React strict mode double-mount
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markerRef.current = null;
      leafletRef.current = null;
    }

    // @ts-expect-error — CSS dynamic import handled by Next.js bundler
    Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([L]) => {
      if (!containerRef.current) return;

      const hasCoords = latitude != null && longitude != null;
      const center: [number, number] = hasCoords
        ? [latitude, longitude]
        : userCoords
          ? [userCoords.latitude, userCoords.longitude]
          : [40, -95];
      const zoom = hasCoords || userCoords ? 14 : 3;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView(center, zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      leafletRef.current = L;
      mapRef.current = map;
      setMapReady(true);

      // Place initial marker if coordinates exist
      if (hasCoords) {
        placeMarker(latitude, longitude);
      }

      // Click to place/move marker
      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        const lat = Math.round(e.latlng.lat * 1000000) / 1000000;
        const lng = Math.round(e.latlng.lng * 1000000) / 1000000;
        placeMarker(lat, lng);
        onChangeRef.current(lat, lng);
      });

      // Fix size after accordion transition
      setTimeout(() => map.invalidateSize(), 100);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        leafletRef.current = null;
        setMapReady(false);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const handleUseMyLocation = useCallback(() => {
    if (userCoords) {
      const lat = Math.round(userCoords.latitude * 1000000) / 1000000;
      const lng = Math.round(userCoords.longitude * 1000000) / 1000000;
      placeMarker(lat, lng);
      mapRef.current?.flyTo([lat, lng], 14);
      onChangeRef.current(lat, lng);
    } else {
      requestPermission();
    }
  }, [userCoords, placeMarker, requestPermission]);

  // Invalidate map size when accordion expands
  const handleAccordionChange = useCallback((_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded);
    if (isExpanded && mapRef.current) {
      setTimeout(() => mapRef.current?.invalidateSize(), 200);
    }
  }, []);

  const hasLocation = latitude != null && longitude != null;

  return (
    <Accordion
      expanded={expanded}
      onChange={handleAccordionChange}
      variant="outlined"
      disableGutters
      sx={{ '&:before': { display: 'none' }, borderRadius: 1 }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MapOutlined fontSize="small" color="action" />
          <MuiTypography variant="body2">
            {hasLocation
              ? `Location: ${latitude!.toFixed(4)}, ${longitude!.toFixed(4)}`
              : 'Set location on map'}
          </MuiTypography>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0 }}>
        <Box sx={{ position: 'relative' }}>
          <div ref={containerRef} style={{ width: '100%', height: 200, borderRadius: '0 0 4px 4px' }} />
          {mapReady && (
            <MuiButton
              size="small"
              variant="contained"
              startIcon={<MyLocationOutlined />}
              onClick={handleUseMyLocation}
              sx={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                zIndex: 1000,
                fontSize: '0.75rem',
                textTransform: 'none',
              }}
            >
              My location
            </MuiButton>
          )}
        </Box>
        <MuiTypography variant="caption" color="text.secondary" sx={{ px: 2, py: 1, display: 'block' }}>
          Click the map to set your board&apos;s location, or drag the marker to adjust
        </MuiTypography>
      </AccordionDetails>
    </Accordion>
  );
}
