import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
// Import CircularProgress
import { Slider, Typography, Box, Select, MenuItem, InputLabel, FormControl, Button, CircularProgress } from '@mui/material';

// Import date picker components
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

function MapComponent() {
    // State for UI controls
    const [selectedDate, setSelectedDate] = useState(null);
    const [threshold, setThreshold] = useState(1920);
    const [basemap, setBasemap] = useState('SATELLITE');
    const [geeTileUrl, setGeeTileUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false); // New loading state

    useEffect(() => {
        setIsLoading(true); // Start loading

        let apiUrl = `http://127.0.0.1:5000/api/map?threshold=${threshold}`;
        if (selectedDate) {
            const formattedDate = selectedDate.format('YYYY-MM-DD');
            apiUrl += `&date=${formattedDate}`;
        }

        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                if (data.tileUrl) {
                    setGeeTileUrl(data.tileUrl);
                }
            })
            .catch(error => console.error("Error fetching GEE tiles:", error))
            .finally(() => {
                setIsLoading(false); // Stop loading
            });
    }, [selectedDate, threshold]);

    const basemaps = {
        SATELLITE: 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        ROADMAP: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box sx={{ display: 'flex', height: '100vh' }}>
                {/* --- UI CONTROLS PANEL --- */}
                <Box sx={{ width: '300px', padding: '16px', backgroundColor: '#f5f5f5' }}>
                    {/* ... (Your other controls are here and unchanged) ... */}
                    <Typography variant="h6" gutterBottom>Methane Mapper Controls</Typography>
                    <FormControl fullWidth sx={{ mt: 2 }}>
                        <InputLabel>Basemap</InputLabel>
                        <Select value={basemap} label="Basemap" onChange={(e) => setBasemap(e.target.value)}>
                            <MenuItem value={'SATELLITE'}>Satellite</MenuItem>
                            <MenuItem value={'ROADMAP'}>Roadmap</MenuItem>
                        </Select>
                    </FormControl>
                    <Typography gutterBottom sx={{ mt: 4 }}>Select Date</Typography>
                    <DatePicker label="Emission Date" value={selectedDate} onChange={(newValue) => setSelectedDate(newValue)} disableFuture />
                    <Button variant="outlined" size="small" sx={{ mt: 1 }} onClick={() => setSelectedDate(null)}>Reset to Latest</Button>
                    <Typography gutterBottom sx={{ mt: 4 }}>Sensitivity Threshold (ppb)</Typography>
                    <Slider value={threshold} onChange={(e, newValue) => setThreshold(newValue)} aria-labelledby="threshold-slider" valueLabelDisplay="auto" min={1850} max={2000} step={5} />
                </Box>

                {/* --- MAP DISPLAY --- */}
                <Box sx={{ flexGrow: 1, position: 'relative' }}> {/* Add position: 'relative' */}
                    <MapContainer center={[36.5, -119.5]} zoom={6} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url={basemaps[basemap]} attribution='&copy; Google / OpenStreetMap contributors' subdomains={basemap === 'SATELLITE' ? ['mt0', 'mt1', 'mt2', 'mt3'] : ['a', 'b', 'c']} />
                        {geeTileUrl && !isLoading && ( // Only show tiles when not loading
                            <TileLayer key={geeTileUrl} url={geeTileUrl} attribution="Google Earth Engine | Copernicus" opacity={0.7} zIndex={10} />
                        )}
                    </MapContainer>

                    {/* --- LOADING OVERLAY --- */}
                    {isLoading && (
                        <Box sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            zIndex: 20, // Make sure it's on top
                        }}>
                            <CircularProgress color="inherit" sx={{ color: 'white' }} />
                        </Box>
                    )}
                </Box>
            </Box>
        </LocalizationProvider>
    );
}

export default MapComponent;