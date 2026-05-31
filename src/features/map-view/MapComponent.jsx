import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Generate a custom HTML pin with a specific color
const createColoredPin = (color) => {
  return L.divIcon({
    className: 'custom-pin',
    html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
};

const MapComponent = ({ userLatLng, results, resultColors }) => {
  // Parse User Coordinates
  const parseCoords = (coordString) => {
    if (!coordString) return null;
    const parts = coordString.split(',');
    if (parts.length === 2) {
      return [parseFloat(parts[0]), parseFloat(parts[1])];
    }
    return null;
  };

  const userCenter = parseCoords(userLatLng) || [20.5937, 78.9629]; // Default to center of India if missing

  return (
    <div style={{ height: '100%', width: '100%', zIndex: 0 }}>
      <MapContainer center={userCenter} zoom={11} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        
        {/* User Pin (Black) */}
        {parseCoords(userLatLng) && (
          <Marker position={parseCoords(userLatLng)} icon={createColoredPin('#000000')}>
            <Popup>User Location</Popup>
          </Marker>
        )}

        {/* POI Pins (Colored dynamically) */}
        {results.map((res, index) => {
          const pinCoords = parseCoords(res.pinLatLng);
          if (pinCoords) {
            return (
              <Marker key={index} position={pinCoords} icon={createColoredPin(resultColors[index % resultColors.length])}>
                <Popup>{res.number} {res.title}</Popup>
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