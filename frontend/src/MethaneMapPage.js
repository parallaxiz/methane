import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import MarkerClusterGroup from '@changey/react-leaflet-markercluster';

import { Slider, Typography, Box, Select, MenuItem, InputLabel, FormControl, Button, CircularProgress, Paper, Grid } from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

function MethaneMapPage() {
    // --- State for controls ---
    const [layerType, setLayerType] = useState('gee'); // 'gee' or 'carbonMapper'
    const [selectedDate, setSelectedDate] = useState(null);
    const [threshold, setThreshold] = useState(1920);
    const [basemap, setBasemap] = useState('SATELLITE');

    // --- State for data and loading ---
    const [geeTileUrl, setGeeTileUrl] = useState('');
    const [carbonMapperData, setCarbonMapperData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // useEffect for fetching GEE satellite data
    useEffect(() => {
        if (layerType !== 'gee') {
            setGeeTileUrl(''); // Clear GEE tiles if not selected
            return;
        }

        setIsLoading(true);
        setError(null);
        let apiUrl = `http://127.0.0.1:5000/api/map?threshold=${threshold}`;
        if (selectedDate) {
            apiUrl += `&date=${selectedDate.format('YYYY-MM-DD')}`;
        }
        fetch(apiUrl).then(res => res.json()).then(data => {
            if (data.tileUrl) setGeeTileUrl(data.tileUrl);
            else {
                setGeeTileUrl('');
                setError(data.message || 'No satellite data available.');
            }
        }).catch(err => setError('Failed to load satellite data.')).finally(() => setIsLoading(false));
    }, [selectedDate, threshold, layerType]);

    // useEffect for fetching Carbon Mapper data
    useEffect(() => {
        if (layerType !== 'carbonMapper') {
            setCarbonMapperData(null); // Clear data if not selected
            return;
        }

        setIsLoading(true);
        setError(null);
        setCarbonMapperData(null);
        fetch('http://127.0.0.1:5000/api/carbonmapper').then(res => res.json()).then(data => {
            if (data.features && data.features.length > 0) {
                setCarbonMapperData(data);
            } else if (data.error) {
                setError("Failed to load high-res plumes.");
            } else {
                setError("No high-resolution plumes found for the selected area.");
            }
        }).catch(err => setError("Failed to load high-res plumes.")).finally(() => setIsLoading(false));
    }, [layerType]);

    const basemaps = {
        SATELLITE: 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        ROADMAP: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    };

    const isGeeDisabled = layerType === 'carbonMapper';

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Paper elevation={4} sx={{ padding: '40px', zIndex: 1100 ,paddingTop: '50px',gap:'30'}}>
                    <Grid container alignItems="center" spacing={3}>
                        <Grid><Typography variant="h5" sx={{ fontWeight: 'bold', }}>Controls:</Typography></Grid>
                        
                        {/* --- NEW: Dropdown for Layer Type --- */}
                        <Grid>
                            <FormControl sx={{ minWidth: 340 }}>
                                <InputLabel>Data Layer</InputLabel>
                                <Select value={layerType} label="Data Layer" onChange={(e) => setLayerType(e.target.value)}>
                                    <MenuItem value={'gee'}>Satellite Heatmap</MenuItem>
                                    <MenuItem value={'carbonMapper'}>High-Res Plumes</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        
                        <Grid>
                            <FormControl sx={{ minWidth: 320 }}>
                                <InputLabel>Basemap</InputLabel>
                                <Select value={basemap} label="Basemap" onChange={(e) => setBasemap(e.target.value)}>
                                    <MenuItem value={'SATELLITE'}>Satellite</MenuItem>
                                    <MenuItem value={'ROADMAP'}>Roadmap</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        
                        {/* --- Controls for GEE (conditionally disabled) --- */}
                        <Grid>
                            <Box sx={{ display: 'flex', alignItems: 'center', opacity: isGeeDisabled ? 0 : 1, transition: 'opacity 0.3s' }}>
                                <DatePicker 
                                    label="Satellite Date" 
                                    value={selectedDate} 
                                    onChange={(newValue) => setSelectedDate(newValue)} 
                                    disableFuture 
                                    sx={{ minWidth: 240 }}
                                    disabled={isGeeDisabled}
                                />
                                <Button variant="contained" onClick={() => setSelectedDate(null)} sx={{ height: '56px', px: 5, fontSize: '2rem' }} disabled={isGeeDisabled}>
                                    Latest
                                </Button>
                            </Box>
                        </Grid>
                        <Grid >
                            <Box sx={{ minWidth: 300, opacity: isGeeDisabled ? 0.0 : 1, transition: 'opacity 0.3s' }}>
                                <Typography variant="body1" gutterBottom>Sensitivity ({threshold} ppb)</Typography>
                                <Slider 
                                    value={threshold} 
                                    onChange={(e, newValue) => setThreshold(newValue)} 
                                    min={1850} max={2000} step={5} 
                                    sx={{ '& .MuiSlider-track': { height: 8 }, '& .MuiSlider-rail': { height: 8 }, '& .MuiSlider-thumb': { height: 24, width: 24 } }}
                                    disabled={isGeeDisabled}
                                />
                            </Box>
                        </Grid>
                    </Grid>
                </Paper>

                <Box sx={{ flexGrow: 1, position: 'relative' }}>
                    <MapContainer center={[36.5, -119.5]} zoom={7} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url={basemaps[basemap]} attribution='&copy; Google / OpenStreetMap contributors' subdomains={['mt0', 'mt1', 'mt2', 'mt3']} />
                        
                        {/* Conditionally render the selected layer */}
                        {layerType === 'gee' && geeTileUrl && (
                            <TileLayer key={geeTileUrl} url={geeTileUrl} attribution="Google Earth Engine | Copernicus" opacity={0.7} zIndex={10} />
                        )}

                        {layerType === 'carbonMapper' && carbonMapperData && (
                            <MarkerClusterGroup>
                                {carbonMapperData.features.map(feature => {
                                    const { geometry, properties } = feature;
                                    const latLng = [geometry.coordinates[1], geometry.coordinates[0]];
                                    const emissionRate = properties.emission_auto ? `${properties.emission_auto.toFixed(2)} kg/hr` : 'Not available';

                                    return (
                                        <Marker key={properties.plume_id} position={latLng}>
                                            <Popup>
                                                <b>Plume ID:</b> {properties.plume_id}<br/>
                                                <b>Methane Rate:</b> {emissionRate}
                                            </Popup>
                                        </Marker>
                                    );
                                })}
                            </MarkerClusterGroup>
                        )}
                    </MapContainer>

                    {isLoading && <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 20 }}><CircularProgress color="inherit" sx={{ color: 'white' }} /></Box>}
                    {error && !isLoading && <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(255, 255, 255, 0.9)', padding: '20px', borderRadius: '8px', zIndex: 20 }}><Typography color="error" variant="h6">Request Failed</Typography><Typography>{error}</Typography></Box>}
                </Box>
            </Box>
        </LocalizationProvider>
    );
}

export default MethaneMapPage;