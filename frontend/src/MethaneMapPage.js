import React, { useState, useEffect } from 'react';
// 🔥 ADDED LayersControl HERE
import { MapContainer, TileLayer, Marker, Popup, ImageOverlay, useMap, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import MarkerClusterGroup from '@changey/react-leaflet-markercluster';
import './MethaneMap.css'; 
import factoriesData from './data/factories.js'; 

import { Slider, Typography, Box, Button, CircularProgress, Paper, Grid, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

// --- ICONS ---
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

// --- HELPER ---
const MapUpdater = () => {
    const map = useMap();
    useEffect(() => {
        const timer = setTimeout(() => { 
            try { map.invalidateSize(); } catch (e) { console.log("Map resized safely"); }
        }, 200);
        return () => clearTimeout(timer);
    }, [map]);
    return null;
};

function MethaneMapPage() {
    // UI Navigation State
    const [activePage, setActivePage] = useState('home');

    // Map Logic State
    const [layerType, setLayerType] = useState('gee');
    const [selectedDate, setSelectedDate] = useState(null);
    const [threshold, setThreshold] = useState(1920);
    const [basemap, setBasemap] = useState('satellite');
    const [geeTileUrl, setGeeTileUrl] = useState('');
    const [carbonMapperData, setCarbonMapperData] = useState(null);
    const [predictionData, setPredictionData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [sourceAttribution, setSourceAttribution] = useState('');
    
    // Factory State
    const [factoryData, setFactoryData] = useState([]); 
    const [showFactories, setShowFactories] = useState(false);

    // 🔥 ADDED METHANE LAYER URL
    const METHANE_LAYER_URL = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?TIME=2023-10-01&layer=MODIS_Terra_Aerosol&tilematrixset=250m&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image%2Fpng&TileMatrix={z}&TileCol={x}&TileRow={y}";

    // --- DATA LOADING ---
    const loadFactories = () => {
        if (factoriesData && factoriesData.length > 0) {
            setFactoryData(factoriesData);
            setShowFactories(true);
        } else {
            setError("No factory data found.");
        }
    };

    // --- NAVIGATION HANDLER ---
    const handleNav = (page, type = null) => {
        setActivePage(page);
        if (type) {
            setLayerType(type);
            if (page !== 'methane-viz') {
                setShowFactories(false); 
            }
        }
    };

    const mapViews = {
        gee: { center: [20, 0], zoom: 3 }, 
        carbonMapper: { center: [20, 0], zoom: 2 },
        prediction: { center: [20, 0], zoom: 2 },
        attribution: { center: [20, 0], zoom: 2 }
    };

    // --- EFFECTS ---
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

    useEffect(() => {
        if (layerType !== 'carbonMapper' && layerType !== 'prediction') {
            setCarbonMapperData(null); 
            setPredictionData(null);
            return;
        }
        setIsLoading(true);
        setError(null);
        
        // ... inside useEffect ...
        if (layerType === 'prediction') {
             // 1. Get the current center of the map view
             // We default to a California hotspot if map isn't ready
             const center = mapViews['prediction'].center; 
        
             fetch('http://127.0.0.1:5000/api/predict', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 // 🔥 CHANGE: Send 'lat' and 'lon' along with 'date'
                 body: JSON.stringify({ 
                     date: selectedDate ? selectedDate.format('YYYY-MM-DD') : '2023-06-01',
                     lat: center[0],
                     lon: center[1]
                 })
             }).then(res => res.json()).then(data => {
                 if (data.heatmap_image) {
                     console.log("🔥 Heatmap received!");
                     setPredictionData(data); // This triggers the ImageOverlay
                 } else if (data.status === 'error') {
                     setError(data.message || "Failed to generate prediction.");
                 }
             }).catch(err => {
                 console.error(err);
                 setError("Failed to connect to prediction API.");
             }).finally(() => setIsLoading(false));
        }

        else {
             fetch('http://127.0.0.1:5000/api/carbonmapper').then(res => res.json()).then(data => {
                 if (data.features && data.features.length > 0) setCarbonMapperData(data);
                 else setError("No EMIT plumes found.");
             }).catch(err => setError("Failed to load EMIT plumes.")).finally(() => setIsLoading(false));
        }
    }, [layerType, selectedDate]);

    const handleSourceAttribution = async (e) => {
        console.log("Attribution clicked at:", e.latlng);
    };

    const isGeeDisabled = layerType !== 'gee';

    // --- REUSABLE MAP COMPONENT ---
    const RenderMap = () => (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'rgba(25,25,50,0.8)', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(79,209,199,0.2)' }}>
                {/* Controls Bar */}
                <Paper elevation={0} sx={{ padding: '10px 16px', background: 'transparent', color: 'white', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <Grid container alignItems="center" spacing={2}>
                        <Grid item>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#4fd1c7' }}>
                                {activePage === 'methane-viz' && 'Methane Heatmap'}
                                {activePage === 'emit-viz' && 'EMIT Plume Data'}
                                {activePage === 'prediction' && 'AI Prediction Model'}
                            </Typography>
                        </Grid>

                        {/* Load Factories Button (Only for Methane Viz) */}
                        {activePage === 'methane-viz' && (
                            <Grid item>
                                <Button 
                                    variant="contained" 
                                    onClick={loadFactories}
                                    sx={{ backgroundColor: '#4fd1c7', color: '#0f0f23', fontWeight: 'bold' }}
                                >
                                Source Attribution
                                </Button>
                            </Grid>
                        )}

                        <Grid item>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, opacity: isGeeDisabled ? 0.4 : 1 }}>
                                <DatePicker 
                                    label="Date" 
                                    value={selectedDate} 
                                    onChange={(newValue) => setSelectedDate(newValue)} 
                                    disableFuture 
                                    sx={{ 
                                        input: { color: 'white' },
                                        label: { color: '#a0a0c0' },
                                        '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' }
                                    }}
                                    disabled={isGeeDisabled} 
                                />
                            </Box>
                        </Grid>
                        
                        {/* Sensitivity Slider (Only for Methane Viz) */}
                        {activePage === 'methane-viz' && (
                            <Grid item xs>
                                <Box sx={{ minWidth: 200 }}>
                                    <Typography variant="caption" sx={{color: '#a0a0c0'}}>Sensitivity ({threshold} ppb)</Typography>
                                    <Slider 
                                        value={threshold} 
                                        onChange={(e, val) => setThreshold(val)} 
                                        min={1850} max={2000} step={5} 
                                        sx={{ color: '#4fd1c7' }}
                                    />
                                </Box>
                            </Grid>
                        )}
                    </Grid>
                </Paper>

                {/* Map Area */}
                <Box sx={{ flexGrow: 1, position: 'relative', height: '100%' }}>
                    <MapContainer 
                        center={mapViews[layerType]?.center || [20, 0]} 
                        zoom={mapViews[layerType]?.zoom || 3} 
                        style={{ height: '100%', width: '100%' }}
                        eventHandlers={{ click: layerType === 'attribution' ? handleSourceAttribution : undefined }}
                    >
                        <MapUpdater />
                        
                        {/* 🔥 NEW LAYERS CONTROL BLOCK */}
                        <LayersControl position="topright">
                            {/* Your Base Map (Standard View) */}
                            <LayersControl.BaseLayer checked name="Standard Map">
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                            </LayersControl.BaseLayer>

                            {/* Optional Satellite Basemap */}
                            <LayersControl.BaseLayer name="Satellite">
                                <TileLayer
                                    url='https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
                                    subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                                    attribution='&copy; Google'
                                />
                            </LayersControl.BaseLayer>

                            {/* THE NEW METHANE BLOCK */}
                            <LayersControl.Overlay name="Methane Concentration">
                                <TileLayer
                                    url={METHANE_LAYER_URL}
                                    opacity={0.6} // Semi-transparent so you can see the map below
                                    zIndex={1000}
                                />
                            </LayersControl.Overlay>
                        </LayersControl>
                        {/* END NEW LAYERS CONTROL */}
                        
                        {/* Application Specific Layers */}
                        {layerType === 'gee' && geeTileUrl && <TileLayer url={geeTileUrl} opacity={0.7} zIndex={10} />}
                        {layerType === 'attribution' && sourceAttribution && <TileLayer url={sourceAttribution} opacity={0.7} zIndex={15} />}
                        {layerType === 'prediction' && predictionData && <ImageOverlay url={predictionData.heatmap_image} bounds={predictionData.bounds} opacity={0.8} zIndex={1000} />}

                        {/* Factories */}
                        {activePage === 'methane-viz' && showFactories && factoryData.length > 0 && (
                            <MarkerClusterGroup chunkedLoading>
                                {factoryData.map((f, i) => (
                                    <Marker key={i} position={[f.lat, f.lng]} icon={factoryIcon}>
                                        <Popup><b>{f.name}</b><br/>{f.type}</Popup>
                                    </Marker>
                                ))}
                            </MarkerClusterGroup>
                        )}

                        {/* Plumes */}
                        {(layerType === 'carbonMapper' || layerType === 'prediction') && carbonMapperData && (
                            <MarkerClusterGroup chunkedLoading>
                                {carbonMapperData.features.map(f => (
                                    <Marker key={f.properties.plume_id} position={[f.geometry.coordinates[1], f.geometry.coordinates[0]]} icon={getPlumeIcon(f.properties.is_predicted ? 'blue' : 'red')}>
                                        <Popup><b>Plume ID:</b> {f.properties.plume_id}</Popup>
                                    </Marker>
                                ))}
                            </MarkerClusterGroup>
                        )}
                    </MapContainer>

                    {isLoading && <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000 }}><CircularProgress sx={{ color: '#4fd1c7' }} /></Box>}
                </Box>
            </Box>
        </LocalizationProvider>
    );

    // --- MAIN RENDER ---
    return (
        <div className="app-root">
            <video id="bg-video" autoPlay muted loop playsInline>
                <source src="/earth.mp4" type="video/mp4" />
            </video>
            <div className="overlay"></div>
            
            <nav className="navbar">
                <div className="logo">
                    <span>METHANE</span><span className="logo-accent">MAPPER</span>
                </div>
                <ul className="nav-links">
                    <li><button onClick={() => handleNav('home')} className={`nav-link ${activePage === 'home' ? 'active' : ''}`} style={{background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem'}}>Home</button></li>
                    <li><button onClick={() => handleNav('methane-viz', 'gee')} className={`nav-link ${activePage === 'methane-viz' ? 'active' : ''}`} style={{background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem'}}>Sentinel - 5P</button></li>
                    <li><button onClick={() => handleNav('emit-viz', 'carbonMapper')} className={`nav-link ${activePage === 'emit-viz' ? 'active' : ''}`} style={{background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem'}}>EMIT Satellite</button></li>
                    <li><button onClick={() => handleNav('prediction', 'prediction')} className={`nav-link ${activePage === 'prediction' ? 'active' : ''}`} style={{background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem'}}>Prediction</button></li>
                </ul>
            </nav>

            <main className="content">
                <section id="home" className={`page ${activePage === 'home' ? 'active' : ''}`}>
                    <div className="hero">
                        <h1 className="hero-title">Global Methane Emissions Monitoring</h1>
                        <p className="hero-subtitle">
                            Methane is one of the most powerful greenhouse gases—over 80 times more potent than CO₂ over 20 years.
                            Tracking methane emissions from industries, landfills, and agriculture is critical to slowing climate change. Our platform helps detect, analyze, and monitor methane leaks for faster climate action.
                        </p>
                        <div className="cta-buttons">
                            <button className="btn-primary" onClick={() => handleNav('methane-viz', 'gee')}>Launch Methane Map</button>
                            <button className="btn-secondary">Documentation</button>
                        </div>
                    </div>
                    
                    <div className="features-grid">
                        <div className="feature">
                            <div className="feature-icon">🛰</div>
                            <h3>Satellite Data Fusion</h3>
                            <p>S5P Sentinel-5P, EMIT, and Carbon Mapper datasets</p>
                        </div>
                        <div className="feature">
                            <div className="feature-icon">📊</div>
                            <h3>Real-time Visualization</h3>
                            <p>Interactive heatmaps and emission plume markers</p>
                        </div>
                        <div className="feature">
                            <div className="feature-icon">🏭</div>
                            <h3>Industrial Correlation</h3>
                            <p>1.2M+ factory locations overlaid with emission data</p>
                        </div>
                    </div>
                </section>

                <section id="methane-viz" className={`page ${activePage === 'methane-viz' ? 'active' : ''}`}>
                    <div className="app-placeholder" style={{border: 'none', background: 'transparent', height: '70vh'}}>
                        {activePage === 'methane-viz' && <RenderMap />}
                    </div>
                </section>

                <section id="emit-viz" className={`page ${activePage === 'emit-viz' ? 'active' : ''}`}>
                    <div className="app-placeholder" style={{border: 'none', background: 'transparent', height: '70vh'}}>
                        {activePage === 'emit-viz' && <RenderMap />}
                    </div>
                </section>

                <section id="prediction" className={`page ${activePage === 'prediction' ? 'active' : ''}`}>
                    <div className="app-placeholder" style={{border: 'none', background: 'transparent', height: '70vh'}}>
                        {activePage === 'prediction' && <RenderMap />}
                    </div>
                </section>
            </main>
        </div>
    );
}

export default MethaneMapPage;