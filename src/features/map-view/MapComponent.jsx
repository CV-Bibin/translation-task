import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// 1. Standard Result Pin (Colored Circle)
const createColoredPin = (color) => {
  return L.divIcon({
    className: 'custom-pin',
    html: `<div style="background-color: ${color}; width: 22px; height: 22px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.4);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
};

// 2. Ground Truth Pin (Blue Star for Ola Maps data)
const createStarPin = () => {
  return L.divIcon({
    className: 'star-pin',
    html: `<div style="filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.4));">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0d6efd" width="28px" height="28px" stroke="white" strokeWidth="1.5">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
           </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
};

// 3. Manual Viewport Pin (Green Target for clicks)
const createViewportPin = () => {
  return L.divIcon({
    className: 'viewport-pin',
    html: `<div style="filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.4)); background-color: white; border-radius: 50%;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#28a745" strokeWidth="3" width="24px" height="24px">
              <circle cx="12" cy="12" r="9"/><line x1="12" y1="7" x2="12" y2="17"/><line x1="7" y1="12" x2="17" y2="12"/>
            </svg>
           </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

// Component to handle map clicks and pass coordinates back
const MapClickHandler = ({ onMapClick, isClickable }) => {
  useMapEvents({
    click(e) {
      if (isClickable && onMapClick) {
        onMapClick(`${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`);
      }
    },
  });
  return null;
};

const MapComponent = ({ 
  userLatLng, 
  results, 
  resultColors, 
  realData = [], 
  manualViewportLatLng, 
  onMapClick, 
  isTipsMode 
}) => {
  
  const parseCoords = (coordString) => {
    if (!coordString) return null;
    const parts = coordString.split(',');
    if (parts.length === 2) {
      return [parseFloat(parts[0]), parseFloat(parts[1])];
    }
    return null;
  };

  // Center map on user, or clicked viewport, or default to center of India
  const userCenter = parseCoords(userLatLng) || parseCoords(manualViewportLatLng) || [20.5937, 78.9629];

  return (
    <div style={{ height: '100%', width: '100%', zIndex: 0, position: 'relative' }}>
      
      {/* Visual cue telling the user to click the map in Tips mode */}
      {isTipsMode && !manualViewportLatLng && (
        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, backgroundColor: '#28a745', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', pointerEvents: 'none' }}>
          Tap map to set Viewport Center
        </div>
      )}

      <MapContainer center={userCenter} zoom={11} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        />
        
        {/* Invisible Click Listener */}
        <MapClickHandler onMapClick={onMapClick} isClickable={isTipsMode} />

        {/* 1. User Pin (Black) - ALWAYS VISIBLE */}
        {parseCoords(userLatLng) && (
          <Marker position={parseCoords(userLatLng)} icon={createColoredPin('#000000')}>
            <Popup><strong>User Location</strong></Popup>
          </Marker>
        )}

        {/* 2. Manual Viewport Pin (Green Target) - ONLY VISIBLE IN TIPS MODE */}
        {isTipsMode && parseCoords(manualViewportLatLng) && (
          <Marker position={parseCoords(manualViewportLatLng)} icon={createViewportPin()}>
            <Popup><strong>Manual Viewport Center</strong></Popup>
          </Marker>
        )}

        {/* 3. Task POI Pins (Colored dynamically) - ALWAYS VISIBLE */}
        {results.map((res, index) => {
          const pinCoords = parseCoords(res.pinLatLng);
          if (pinCoords) {
            return (
              <Marker key={`res-${index}`} position={pinCoords} icon={createColoredPin(resultColors[index % resultColors.length])}>
                <Popup><b>{res.number}</b> {res.title}</Popup>
              </Marker>
            );
          }
          return null;
        })}

        {/* 4. Ground Truth / Ola Maps Pins (Blue Stars) - ONLY VISIBLE IN TIPS MODE */}
        {isTipsMode && realData.map((poi, index) => {
          if (poi.lat && poi.lng) {
            return (
              <Marker key={`real-${index}`} position={[poi.lat, poi.lng]} icon={createStarPin()}>
                <Popup>
                  <div style={{ color: '#0d6efd', fontWeight: 'bold', borderBottom: '1px solid #ccc', paddingBottom: '4px', marginBottom: '4px' }}>
                    Ground Truth (Ola Maps)
                  </div>
                  <b>{poi.name}</b><br/>
                  <span style={{ fontSize: '11px', color: '#555' }}>{poi.address}</span>
                </Popup>
              </Marker>
            );
          }
          return null;
        })}
      </MapContainer>
    </div>
  );
};

export default MapComponent;