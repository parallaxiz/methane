import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Slider, Typography, Box, Select, MenuItem, InputLabel, FormControl, Button, CircularProgress, Switch, FormControlLabel, Paper, Grid } from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

function MethaneMapPage() {
    // --- All your state and useEffect hooks remain the same ---
    const [selectedDate, setSelectedDate] = useState(null);
    const [threshold, setThreshold] = useState(1920);
    const [geeTileUrl, setGeeTileUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showCarbonMapper, setShowCarbonMapper] = useState(false);
    const [carbonMapperData, setCarbonMapperData] = useState(null);
    const [isCarbonMapperLoading, setIsCarbonMapperLoading] = useState(false);
    const [basemap, setBasemap] = useState('SATELLITE');

    // (Your useEffect hooks for fetching data are unchanged)
    useEffect(() => {
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
    }, [selectedDate, threshold]);

    useEffect(() => {
        if (showCarbonMapper) {
            setIsCarbonMapperLoading(true);
            setCarbonMapperData(null);
            fetch('http://127.0.0.1:5000/api/carbonmapper').then(res => res.json()).then(data => {
                if (data.features && data.features.length > 0) {
                    setCarbonMapperData(data);
                } else if (data.error) {
                    setError("Failed to load high-res plumes.");
                } else {
                    setError("No high-resolution plumes found in the selected area.");
                }
            }).catch(err => setError("Failed to load high-res plumes.")).finally(() => setIsCarbonMapperLoading(false));
        }
    }, [showCarbonMapper]);

    const basemaps = {
        SATELLITE: 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        ROADMAP: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    };
    const plumePointStyle = { fillColor: '#ff4d4d', fillOpacity: 0.9, color: 'white', weight: 1.5, radius: 8 };

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                
                <Paper elevation={4} sx={{ padding: '16px', zIndex: 1100 }}>
                    <Grid container alignItems="center" spacing={4}>
                        <Grid>
                            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Controls:</Typography>
                        </Grid>

                        <Grid>
                            <FormControl sx={{ minWidth: 220 }}>
                                <InputLabel>Basemap</InputLabel>
                                <Select value={basemap} label="Basemap" onChange={(e) => setBasemap(e.target.value)}>
                                    <MenuItem value={'SATELLITE'}>Satellite</MenuItem>
                                    <MenuItem value={'ROADMAP'}>Roadmap</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <DatePicker 
                                    label="Satellite Date" 
                                    value={selectedDate} 
                                    onChange={(newValue) => setSelectedDate(newValue)} 
                                    disableFuture 
                                    sx={{ minWidth: 340 }}
                                />
                                <Button variant="contained" onClick={() => setSelectedDate(null)} sx={{ height: '56px', px: 4, fontSize: '1rem' }}>
                                    Latest
                                </Button>
                            </Box>
                        </Grid>

                        <Grid xs>
                            <Box sx={{ minWidth: 300 }}>
                                <Typography variant="body1" gutterBottom>Sensitivity ({threshold} ppb)</Typography>
                                <Slider 
                                    value={threshold} 
                                    onChange={(e, newValue) => setThreshold(newValue)} 
                                    min={1850} max={2000} step={5} 
                                    sx={{ '& .MuiSlider-track': { height: 8 }, '& .MuiSlider-rail': { height: 8 }, '& .MuiSlider-thumb': { height: 24, width: 24 } }}
                                />
                            </Box>
                        </Grid>

                        <Grid>
                            <FormControlLabel
                                control={
                                    <Switch 
                                        checked={showCarbonMapper} 
                                        onChange={(e) => setShowCarbonMapper(e.target.checked)} 
                                        sx={{ transform: 'scale(1.5)', mx: 1 }}
                                    />
                                }
                                label={<Typography variant="body1" sx={{ fontWeight: 500 }}>High-Res Plumes</Typography>}
                                sx={{ mr: 2 }}
                            />
                             {isCarbonMapperLoading && <CircularProgress size={28} />}
                        </Grid>
                    </Grid>
                </Paper>

                <Box sx={{ flexGrow: 1, position: 'relative' }}>
                    <MapContainer center={[36.5, -119.5]} zoom={6} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url={basemaps[basemap]} attribution='&copy; Google / OpenStreetMap contributors' subdomains={['mt0', 'mt1', 'mt2', 'mt3']} />
                        
                        {geeTileUrl && !isLoading && <TileLayer key={geeTileUrl} url={geeTileUrl} attribution="Google Earth Engine | Copernicus" opacity={0.7} zIndex={10} />}

                        {showCarbonMapper && carbonMapperData && (
                            <GeoJSON 
                                key={JSON.stringify(carbonMapperData)}
                                data={carbonMapperData}
                                pointToLayer={(feature, latlng) => L.circleMarker(latlng, plumePointStyle)}
                                onEachFeature={(feature, layer) => {
                                    // --- THIS IS THE FIX ---
                                    // Use the correct property names from the API: 'plume_id' and 'emission_auto'
                                    if (feature.properties) {
                                        const emissionRate = feature.properties.emission_auto ? `${feature.properties.emission_auto.toFixed(2)} kg/hr` : 'Not available';
                                        layer.bindPopup(`<b>Plume ID:</b> ${feature.properties.plume_id}<br/><b>Methane Rate:</b> ${emissionRate}`);
                                    }
                                }}
                            />
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

