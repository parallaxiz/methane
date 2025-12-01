import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import MarkerClusterGroup from '@changey/react-leaflet-markercluster';

import { Slider, Typography, Box, Select, MenuItem, InputLabel, FormControl, Button, CircularProgress, Paper, Grid } from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

// Helper component to dynamically change the map's view
function ChangeView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

function MethaneMapPage() {
    // --- State for controls ---
    const [layerType, setLayerType] = useState('gee'); // Default to GEE heatmap
    const [selectedDate, setSelectedDate] = useState(null);
    const [threshold, setThreshold] = useState(1920);
    const [basemap, setBasemap] = useState('satellite');
    const [geeTileUrl, setGeeTileUrl] = useState('');
    const [carbonMapperData, setCarbonMapperData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    
    const mapViews = {
      gee: { center: [36.5, -119.5], zoom: 7 }, // California view
      carbonMapper: { center: [20, 0], zoom: 2 }, // Global view
      prediction: { center: [20, 0], zoom: 2 } // Global view
    };

    // useEffect for fetching GEE satellite data
    useEffect(() => {
        if (layerType !== 'gee') {
            setGeeTileUrl(''); return;
        }
        setIsLoading(true);
        setError(null);
        let apiUrl = `http://127.0.0.1:5000/api/map?threshold=${threshold}`;
        if (selectedDate) apiUrl += `&date=${selectedDate.format('YYYY-MM-DD')}`;
        
        fetch(apiUrl).then(res => res.json()).then(data => {
            if (data.tileUrl) setGeeTileUrl(data.tileUrl);
            else { setGeeTileUrl(''); setError(data.message || 'No GEE data available.'); }
        }).catch(err => setError('Failed to load GEE data.')).finally(() => setIsLoading(false));
    }, [selectedDate, threshold, layerType]);

    // useEffect for fetching EMIT/Prediction data
    useEffect(() => {
        if (layerType !== 'carbonMapper' && layerType !== 'prediction') {
            setCarbonMapperData(null); return;
        }
        setIsLoading(true);
        setError(null);
        
        // Use the prediction endpoint if selected, otherwise use the normal plumes endpoint
        const apiEndpoint = layerType === 'prediction' ? '/api/global-prediction' : '/api/carbonmapper';
        
        fetch('http://127.0.0.1:5000' + apiEndpoint).then(res => res.json()).then(data => {
            if (data.features && data.features.length > 0) setCarbonMapperData(data);
            else if (data.error) setError("Failed to load plume data.");
            else setError("No EMIT plumes found.");
        }).catch(err => setError("Failed to load EMIT/Prediction plumes.")).finally(() => setIsLoading(false));
    }, [layerType]);

    const basemaps = {
        satellite: 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
    };
    
    // GEE controls are disabled if High-Res or Prediction is selected
    const isGeeDisabled = layerType !== 'gee';

    // Auto-switch basemap based on layer type
    useEffect(() => {
        if (layerType === 'carbonMapper' || layerType === 'prediction') setBasemap('light');
        else setBasemap('satellite');
    }, [layerType]);

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Paper elevation={4} sx={{ padding: '16px', zIndex: 1100 }}>
                    <Grid container alignItems="center" spacing={4}>
                        <Grid><Typography variant="h5" sx={{ fontWeight: 'bold' }}>Controls:</Typography></Grid>
                        
                        <Grid>
                            <FormControl sx={{ minWidth: 240 }}>
                                <InputLabel>Data Layer</InputLabel>
                                <Select value={layerType} label="Data Layer" onChange={(e) => setLayerType(e.target.value)}>
                                    <MenuItem value={'gee'}>GEE Heatmap (CA)</MenuItem>
                                    <MenuItem value={'carbonMapper'}>EMIT Sensors (Current)</MenuItem>
                                    <MenuItem value={'prediction'}>Predicted Shift</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        
                        <Grid>
                            <FormControl sx={{ minWidth: 220 }}>
                                <InputLabel>Basemap</InputLabel>
                                <Select value={basemap} label="Basemap" onChange={(e) => setBasemap(e.target.value)}>
                                    <MenuItem value={'satellite'}>Satellite</MenuItem>
                                    <MenuItem value={'light'}>Light Gray</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        
                        {/* --- Controls for GEE (conditionally disabled) --- */}
                        <Grid>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, opacity: isGeeDisabled ? 0.4 : 1, transition: 'opacity 0.3s' }}>
                                <DatePicker label="GEE Date" value={selectedDate} onChange={(newValue) => setSelectedDate(newValue)} disableFuture sx={{ minWidth: 240 }} disabled={isGeeDisabled} />
                                <Button variant="contained" onClick={() => setSelectedDate(null)} sx={{ height: '56px', px: 4, fontSize: '1rem' }} disabled={isGeeDisabled}>Latest</Button>
                            </Box>
                        </Grid>
                        <Grid xs>
                            <Box sx={{ minWidth: 300, opacity: isGeeDisabled ? 0.4 : 1, transition: 'opacity 0.3s' }}>
                                <Typography variant="body1" gutterBottom>Sensitivity ({threshold} ppb)</Typography>
                                <Slider value={threshold} onChange={(e, newValue) => setThreshold(newValue)} min={1850} max={2000} step={5} disabled={isGeeDisabled} />
                            </Box>
                        </Grid>
                    </Grid>
                </Paper>

                <Box sx={{ flexGrow: 1, position: 'relative' }}>
                    <MapContainer center={mapViews[layerType].center} zoom={mapViews[layerType].zoom} style={{ height: '100%', width: '100%' }}>
                        {/* FIX: Correctly render the Basemap with subdomains */}
                        <TileLayer 
                            url={basemaps[basemap]} 
                            attribution={basemap === 'satellite' ? '&copy; Google' : '&copy; CARTO &copy; OpenStreetMap contributors'}
                            subdomains={basemap === 'satellite' ? ['mt0', 'mt1', 'mt2', 'mt3'] : ['a', 'b', 'c']}
                        />
                        
                        {/* GEE Layer */}
                        {layerType === 'gee' && geeTileUrl && (
                            <TileLayer key={geeTileUrl} url={geeTileUrl} attribution="Google Earth Engine | Copernicus" opacity={0.7} zIndex={10} />
                        )}

                        {/* EMIT/Prediction Layer (using clustering) */}
                        {(layerType === 'carbonMapper' || layerType === 'prediction') && carbonMapperData && (
                            <MarkerClusterGroup>
                                {carbonMapperData.features.map(feature => {
                                    const { geometry, properties } = feature;
                                    const latLng = [geometry.coordinates[1], geometry.coordinates[0]];
                                    const emissionRate = properties.emission_auto ? `${properties.emission_auto.toFixed(2)} kg/hr` : 'Not available';
                                    
                                    // Style the predicted markers differently
                                    const isPredicted = properties.is_predicted;
                                    const markerColor = isPredicted ? 'blue' : 'red';
                                    const iconOptions = {
                                        iconUrl: `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="${markerColor}" opacity="0.8"/><circle cx="50" cy="50" r="10" fill="white"/></svg>`)}`,
                                        iconSize: [30, 30],
                                        iconAnchor: [15, 15],
                                        popupAnchor: [0, -15]
                                    };
                                    const icon = L.icon(iconOptions);

                                    return (
                                        <Marker key={properties.plume_id} position={latLng} icon={icon}>
                                            <Popup>
                                                <b>{isPredicted ? 'Predicted Plume' : 'Current Plume'}</b><hr/>
                                                <b>Plume ID:</b> {properties.plume_id}<br/>
                                                <b>Methane Rate:</b> {emissionRate}
                                            </Popup>
                                        </Marker>
                                    );
                                })}
                            </MarkerClusterGroup>
                        )}
                    </MapContainer>

                    {isLoading && <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 2000 }}><CircularProgress color="inherit" sx={{ color: 'white' }} /></Box>}
                    {error && !isLoading && <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(255, 255, 255, 0.9)', padding: '20px', borderRadius: '8px', zIndex: 2000 }}><Typography color="error" variant="h6">Request Failed</Typography><Typography>{error}</Typography></Box>}
                </Box>
            </Box>
        </LocalizationProvider>
    );
}

export default MethaneMapPage;