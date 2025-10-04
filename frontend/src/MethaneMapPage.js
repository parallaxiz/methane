import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Slider, Typography, Box, Select, MenuItem, InputLabel, FormControl, Button, CircularProgress, Switch, FormControlLabel, Paper } from '@mui/material';
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
                if (data.features) setCarbonMapperData(data);
                else if (data.error) setError("Failed to load high-res plumes.");
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
                
                {/* --- UPDATED: Top Controls Bar with larger components --- */}
                <Paper 
                    elevation={4} 
                    sx={{ 
                        padding: '24px 32px',
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '40px',
                        flexWrap: 'wrap', 
                        zIndex: 1100,
                    }}
                >
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Controls:</Typography>

                    <FormControl sx={{ minWidth: 200 }}>
                        <InputLabel>Basemap</InputLabel>
                        <Select value={basemap} label="Basemap" onChange={(e) => setBasemap(e.target.value)}>
                            <MenuItem value={'SATELLITE'}>Satellite</MenuItem>
                            <MenuItem value={'ROADMAP'}>Roadmap</MenuItem>
                        </Select>
                    </FormControl>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <DatePicker 
                            label="Satellite Date" 
                            value={selectedDate} 
                            onChange={(newValue) => setSelectedDate(newValue)} 
                            disableFuture 
                            sx={{ minWidth: 320 }} 
                        />
                        <Button variant="outlined" onClick={() => setSelectedDate(null)} sx={{ height: '56px', px: 4 }}>
                            Latest
                        </Button>
                    </Box>

                    <Box sx={{ minWidth: 550, flexGrow: .2   }}>
                        <Typography variant="body1" gutterBottom>Sensitivity ({threshold} ppb)</Typography>
                        <Slider 
                            value={threshold} 
                            onChange={(e, newValue) => setThreshold(newValue)} 
                            min={1850} max={2000} step={5} 
                            sx={{
                                // Make the slider track thicker
                                '& .MuiSlider-track': { height: 6 },
                                '& .MuiSlider-rail': { height: 6 },
                                // Make the slider thumb larger
                                '& .MuiSlider-thumb': { height: 20, width: 20 },
                            }}
                        />
                    </Box>

                    <FormControlLabel
                        control={
                            <Switch 
                                checked={showCarbonMapper} 
                                onChange={(e) => setShowCarbonMapper(e.target.checked)} 
                                // Scale the switch to be larger
                                sx={{ transform: 'scale(1.4)', mx: 1 }}
                            />
                        }
                        label="High-Res Plumes"
                    />
                     {isCarbonMapperLoading && <CircularProgress size={28} />}

                </Paper>

                {/* --- MAP DISPLAY (Unchanged) --- */}
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
                                    if (feature.properties) {
                                        layer.bindPopup(`<b>Source ID:</b> ${feature.properties.source_id}<br/><b>Methane Rate:</b> ${feature.properties.qmethane.value} kg/hr`);
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