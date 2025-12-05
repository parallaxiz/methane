import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import MarkerClusterGroup from '@changey/react-leaflet-markercluster';
import factoriesData from './data/factories.js';  // 🔥 STATIC IMPORT from src/data/

import { Slider, Typography, Box, Select, MenuItem, InputLabel, FormControl, Button, CircularProgress, Paper, Grid } from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

function MethaneMapPage() {
    const [layerType, setLayerType] = useState('gee');
    const [selectedDate, setSelectedDate] = useState(null);
    const [threshold, setThreshold] = useState(1920);
    const [basemap, setBasemap] = useState('satellite');
    const [geeTileUrl, setGeeTileUrl] = useState('');
    const [carbonMapperData, setCarbonMapperData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // 🔥 JS FACTORY STATES
    const [factoryData, setFactoryData] = useState([]);
    const [showFactories, setShowFactories] = useState(false);

    // 🔥 INSTANT LOAD - NO FETCH/IMPORT NEEDED!
    const loadFactories = async () => {
        if (!selectedDate || !selectedDate.isValid()) {
            setError('Please select a date first');
            return;
        }
        
        setIsLoading(true);
        setError(null);
        
        try {
            console.log('🏭 Loading factories from src/data/factories.js...');
            
            // 🔥 DIRECT ACCESS - Already imported at top!
            setFactoryData(factoriesData);
            console.log(`✅ Loaded ${factoriesData.length} factories INSTANTLY`);
            setError(null);
        } catch (err) {
            console.error('🏭 Factory error:', err);
            setError('❌ factories.js error in src/data/');
        } finally {
            setIsLoading(false);
        }
    };

    const mapViews = {
        gee: { center: [20, 0], zoom: 4 },
        carbonMapper: { center: [20, 0], zoom: 2 },
        prediction: { center: [20, 0], zoom: 2 }
    };

    // ✅ GEE useEffect (unchanged)
    useEffect(() => {
        if (layerType !== 'gee') {
            setGeeTileUrl('');
            return;
        }
        setIsLoading(true);
        setError(null);
        
        let dateStr = '';
        if (selectedDate && selectedDate.isValid()) {
            dateStr = selectedDate.format('YYYY-MM-DD');
        }
        
        let apiUrl = `http://127.0.0.1:5000/api/map?threshold=${threshold}`;
        if (dateStr) apiUrl += `&date=${dateStr}`;
        
        fetch(apiUrl)
            .then(res => res.json())
            .then(data => {
                if (data.tileUrl) {
                    setGeeTileUrl(data.tileUrl);
                    setError(null);
                } else {
                    setGeeTileUrl('');
                    setError(data.message || 'No GEE data available.');
                }
            })
            .catch(err => {
                console.error('GEE error:', err);
                setError('Failed to load GEE data.');
            })
            .finally(() => setIsLoading(false));
    }, [selectedDate, threshold, layerType]);

    // ✅ CarbonMapper (unchanged)
    useEffect(() => {
        if (layerType !== 'carbonMapper' && layerType !== 'prediction') {
            setCarbonMapperData(null);
            return;
        }
        setIsLoading(true);
        setError(null);
        const apiEndpoint = layerType === 'prediction' ? '/api/global-prediction' : '/api/carbonmapper';
        fetch('http://127.0.0.1:5000' + apiEndpoint).then(res => res.json()).then(data => {
            if (data.features && data.features.length > 0) setCarbonMapperData(data);
            else setError("No plumes found.");
        }).catch(err => setError("Failed to load plumes.")).finally(() => setIsLoading(false));
    }, [layerType]);

    const basemaps = {
        satellite: 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
    };
    
    const isGeeDisabled = layerType !== 'gee';

    // 🔥 BIG GREEN FACTORY ICON
    const factoryIcon = L.icon({
        iconUrl: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 100 120">
                <rect x="20" y="10" width="60" height="70" rx="10" fill="#00FF00" stroke="#00CC00" stroke-width="4"/>
                <rect x="35" y="25" width="30" height="20" fill="#66FF66" stroke="#00CC00" stroke-width="2"/>
                <circle cx="50" cy="95" r="15" fill="#00FF00" stroke="#00CC00" stroke-width="3"/>
                <text x="50" y="58" font-size="16" fill="white" text-anchor="middle" font-weight="bold">F</text>
                <text x="50" y="75" font-size="10" fill="black" text-anchor="middle" font-weight="bold">ACTORY</text>
            </svg>
        `)))}`,
        iconSize: [40, 50],
        iconAnchor: [20, 50],
        popupAnchor: [0, -45]
    });

    const getPlumeIcon = (color) => L.icon({
        iconUrl: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="${color}" opacity="0.8"/>
                <circle cx="50" cy="50" r="10" fill="white"/>
            </svg>
        `)))}`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15]
    });

    useEffect(() => {
        if (layerType === 'carbonMapper' || layerType === 'prediction') setBasemap('light');
        else setBasemap('satellite');
    }, [layerType]);

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Paper elevation={4} sx={{ padding: '16px', zIndex: 1100 }}>
                    <Grid container alignItems="center" spacing={2}>
                        <Grid><Typography variant="h5" sx={{ fontWeight: 'bold' }}>Controls:</Typography></Grid>
                        
                        <Grid>
                            <FormControl sx={{ minWidth: 220 }}>
                                <InputLabel>Data Layer</InputLabel>
                                <Select value={layerType} label="Data Layer" onChange={(e) => setLayerType(e.target.value)}>
                                    <MenuItem value={'gee'}>GEE Heatmap (RED)</MenuItem>
                                    <MenuItem value={'carbonMapper'}>EMIT Sensors</MenuItem>
                                    <MenuItem value={'prediction'}>Predicted Shift</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        
                        <Grid>
                            <Button 
                                variant="contained" 
                                onClick={loadFactories}
                                disabled={isGeeDisabled || isLoading}
                                sx={{ height: '56px', px: 2, backgroundColor: '#4CAF50', color: 'white' }}
                            >
                                🏭 Load Factories
                            </Button>
                        </Grid>
                        
                        <Grid>
                            <Button 
                                variant="outlined" 
                                onClick={() => setShowFactories(!showFactories)}
                                disabled={!factoryData.length || isGeeDisabled}
                                sx={{ height: '56px', px: 2 }}
                            >
                                {showFactories ? 'Hide Factories' : 'Show Factories'}
                            </Button>
                        </Grid>
                        
                        <Grid>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, opacity: isGeeDisabled ? 0.4 : 1 }}>
                                <DatePicker 
                                    label="Date" 
                                    value={selectedDate} 
                                    onChange={(newValue) => setSelectedDate(newValue)} 
                                    disableFuture 
                                    sx={{ minWidth: 200 }} 
                                    disabled={isGeeDisabled} 
                                />
                                <Button variant="contained" onClick={() => setSelectedDate(null)} sx={{ height: '56px', px: 1 }} disabled={isGeeDisabled}>
                                    Latest
                                </Button>
                            </Box>
                        </Grid>
                        
                        <Grid xs>
                            <Box sx={{ minWidth: 250, opacity: isGeeDisabled ? 0.4 : 1 }}>
                                <Typography variant="body2" gutterBottom>Sensitivity ({threshold} ppb)</Typography>
                                <Slider value={threshold} onChange={(e, newValue) => setThreshold(newValue)} min={1850} max={2000} step={5} disabled={isGeeDisabled} />
                            </Box>
                        </Grid>
                    </Grid>
                </Paper>

                <Box sx={{ flexGrow: 1, position: 'relative' }}>
                    <MapContainer 
                        center={mapViews[layerType]?.center || [20, 0]} 
                        zoom={mapViews[layerType]?.zoom || 4} 
                        style={{ height: '100%', width: '100%' }}
                    >
                        <TileLayer 
                            url={basemaps[basemap]} 
                            attribution={basemap === 'satellite' ? '© Google' : '© CARTO © OpenStreetMap contributors'}
                            subdomains={basemap === 'satellite' ? ['mt0', 'mt1', 'mt2', 'mt3'] : ['a', 'b', 'c']}
                        />
                        
                        {layerType === 'gee' && geeTileUrl && (
                            <TileLayer key={geeTileUrl} url={geeTileUrl} opacity={0.7} zIndex={10} />
                        )}

                        {showFactories && factoryData.length > 0 && (
                            <MarkerClusterGroup>
                                {factoryData.map((factory, index) => (
                                    <Marker 
                                        key={`factory-${index}`} 
                                        position={[factory.lat, factory.lng]} 
                                        icon={factoryIcon}
                                    >
                                        <Popup>
                                            <b>🏭 {factory.name}</b><br/>
                                            <b>Type:</b> {factory.type || 'Industrial'}<br/>
                                            <b>Coords:</b> {factory.lat}°, {factory.lng}°<br/>
                                            <i>Correlate with nearby RED methane!</i>
                                        </Popup>
                                    </Marker>
                                ))}
                            </MarkerClusterGroup>
                        )}

                        {(layerType === 'carbonMapper' || layerType === 'prediction') && carbonMapperData && (
                            <MarkerClusterGroup>
                                {carbonMapperData.features.map(feature => {
                                    const { geometry, properties } = feature;
                                    const latLng = [geometry.coordinates[1], geometry.coordinates[0]];
                                    const emissionRate = properties.emission_auto ? `${properties.emission_auto.toFixed(2)} kg/hr` : 'Not available';
                                    const isPredicted = properties.is_predicted;
                                    const markerColor = isPredicted ? 'blue' : 'red';
                                    const icon = getPlumeIcon(markerColor);

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

                    {isLoading && (
                        <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 2000 }}>
                            <CircularProgress color="inherit" sx={{ color: 'white' }} />
                        </Box>
                    )}
                    {error && !isLoading && (
                        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(255, 255, 255, 0.9)', padding: '20px', borderRadius: '8px', zIndex: 2000 }}>
                            <Typography color="error" variant="h6">Error</Typography>
                            <Typography>{error}</Typography>
                        </Box>
                    )}
                </Box>
            </Box>
        </LocalizationProvider>
    );
}

export default MethaneMapPage;
