import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Slider, Typography, Box, Select, MenuItem, InputLabel, FormControl } from '@mui/material';

const GEE_TILE_URL_FALLBACK = "https://earthengine.googleapis.com/v1alpha/projects/earthengine-public/maps/e093532429e3052845c63519c7205161-0d306a4e3752e5a40b8a3b5a794e5e43/tiles/{z}/{x}/{y}";


function MapComponent() {
  // State for UI controls
  const [days, setDays] = useState(7);
  const [threshold, setThreshold] = useState(1850);
  const [basemap, setBasemap] = useState('SATELLITE');

  // State to hold the GEE tile URL from our backend
  const [geeTileUrl, setGeeTileUrl] = useState(GEE_TILE_URL_FALLBACK);

  // This effect runs whenever 'days' or 'threshold' changes
  useEffect(() => {
    // Construct the API URL with the current state values
    const apiUrl = `http://127.0.0.1:5000/api/map?days=${days}&threshold=${threshold}`;

    // Fetch the new map tiles from our Flask backend
    fetch(apiUrl)
      .then(response => response.json())
      .then(data => {
        if (data.tileUrl) {
          setGeeTileUrl(data.tileUrl);
        }
      })
      .catch(error => console.error("Error fetching GEE tiles:", error));

  }, [days, threshold]); // Dependency array: re-run effect when these change

  const basemaps = {
    SATELLITE: 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    ROADMAP: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* --- UI CONTROLS PANEL --- */}
      <Box sx={{ width: '300px', padding: '16px', backgroundColor: '#f5f5f5' }}>
        <Typography variant="h6" gutterBottom>Methane Mapper Controls</Typography>
        
        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel>Basemap</InputLabel>
          <Select value={basemap} label="Basemap" onChange={(e) => setBasemap(e.target.value)}>
            <MenuItem value={'SATELLITE'}>Satellite</MenuItem>
            <MenuItem value={'ROADMAP'}>Roadmap</MenuItem>
          </Select>
        </FormControl>

        <Typography gutterBottom sx={{ mt: 4 }}>Date Range (Last X Days)</Typography>
        <Slider value={days} onChange={(e, newValue) => setDays(newValue)} aria-labelledby="days-slider" valueLabelDisplay="auto" min={1} max={30} />
        
        <Typography gutterBottom sx={{ mt: 4 }}>Sensitivity Threshold (ppb)</Typography>
        <Slider value={threshold} onChange={(e, newValue) => setThreshold(newValue)} aria-labelledby="threshold-slider" valueLabelDisplay="auto" min={1800} max={1950} step={5} />
      </Box>

      {/* --- MAP DISPLAY --- */}
      <Box sx={{ flexGrow: 1 }}>
        <MapContainer center={[36.5, -119.5]} zoom={6} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url={basemaps[basemap]}
            attribution='&copy; Google / OpenStreetMap contributors'
            subdomains={basemap === 'SATELLITE' ? ['mt0', 'mt1', 'mt2', 'mt3'] : ['a', 'b', 'c']}
          />
          {geeTileUrl && (
            <TileLayer
              url={geeTileUrl}
              attribution="Google Earth Engine"
              opacity={0.7}
            />
          )}
        </MapContainer>
      </Box>
    </Box>
  );
}

export default MapComponent;