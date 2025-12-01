from flask import Flask, request, jsonify
from flask_cors import CORS
import ee
import datetime
import os
import requests
from dotenv import load_dotenv

# Explicitly import timezone for compatibility with modern Python
from datetime import timezone 

load_dotenv()

app = Flask(__name__)
CORS(app)

try:
    ee.Initialize(project='flash-griffin-473118-e3')
    print("OK: GEE initialized successfully for the server.")
except Exception as e:
    print(f"ERROR: GEE initialization failed: {e}")

@app.route('/api/map', methods=['GET'])
def get_methane_map():
    """Fetches GEE satellite heatmap tiles localized to California (CA)."""
    background_threshold = int(request.args.get('threshold', 1920))
    selected_date_str = request.args.get('date')
    
    # Coordinates for localized California view
    center_lon = -119.5
    center_lat = 36.5
    filter_point = ee.Geometry.Point(center_lon, center_lat)

    methane_collection = ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_CH4') \
        .select('CH4_column_volume_mixing_ratio_dry_air') \
        .filterBounds(filter_point)

    methane_data = None

    if selected_date_str:
        start_date = ee.Date(selected_date_str)
        end_date = start_date.advance(1, 'day')
        daily_collection = methane_collection.filterDate(start_date, end_date)
        if daily_collection.size().getInfo() > 0:
            methane_data = daily_collection.mean()
    else:
        methane_data = methane_collection.sort('system:time_start', False).first()

    if methane_data is None:
        return jsonify({'tileUrl': None, 'message': 'No data available for the selected date.'})

    methane_spots = methane_data.updateMask(methane_data.gt(background_threshold))
    
    peak_threshold = background_threshold + 100 
    spot_style = {
        'min': background_threshold,
        'max': peak_threshold,
        'palette': ['#8B0000', '#FF0000']
    }

    map_info = methane_spots.getMapId(spot_style)

    return jsonify({'tileUrl': map_info['tile_fetcher'].url_format})


@app.route('/api/carbonmapper', methods=['GET'])
def get_carbonmapper_plumes():
    """Fetches global high-resolution plume data (EMIT/Carbon Mapper)."""
    api_key = os.getenv('CARBONMAPPER_API_KEY')
    if not api_key:
        return jsonify({"error": "Carbon Mapper API key not configured"}), 500

    carbon_mapper_url = "https://api.carbonmapper.org/api/v1/catalog/plumes/annotated"
    headers = {"Authorization": f"Bearer {api_key}"}

    end_time = datetime.datetime.now(timezone.utc)
    start_time = end_time - datetime.timedelta(days=365) # Last year of global data
    
    params = {
        "datetime": f"{start_time.isoformat().replace('+00:00', 'Z')}/{end_time.isoformat().replace('+00:00', 'Z')}",
        "plume_gas": "CH4",
        "limit": 5000 
    }

    try:
        response = requests.get(carbon_mapper_url, headers=headers, params=params)
        response.raise_for_status()
        
        items = response.json().get('items', [])
        
        # Reformat the data into valid GeoJSON that Leaflet can use
        formatted_features = []
        for item in items:
            properties = {key: value for key, value in item.items() if key != 'geometry_json'}
            feature = {
                "type": "Feature",
                "geometry": item.get('geometry_json'),
                "properties": properties
            }
            formatted_features.append(feature)

        geojson_response = {
            "type": "FeatureCollection",
            "features": formatted_features
        }
        return jsonify(geojson_response)
        
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Could not fetch from Carbon Mapper API: {e}")
        return jsonify({"error": f"Failed to fetch data from Carbon Mapper: {e}"}), 500


@app.route('/api/wind-data', methods=['GET'])
def get_current_wind():
    """Fetches current wind data from WeatherAPI for a fixed CA location."""
    
    api_key = os.getenv('WEATHERAPI_KEY')
    if not api_key:
        return jsonify({"error": "WeatherAPI key not configured"}), 500

    LAT = 35.37
    LON = -119.01
    
    weather_url = "http://api.weatherapi.com/v1/current.json"
    
    params = {
        "key": api_key,
        "q": f"{LAT},{LON}" 
    }
    
    try:
        response = requests.get(weather_url, params=params)
        response.raise_for_status()
        data = response.json()
        
        current = data.get('current', {})
        
        wind_data = {
            "location_name": data.get('location', {}).get('name', 'Central Valley'),
            "wind_speed_kph": current.get('wind_kph'),
            "wind_direction_deg": current.get('wind_degree'),
            "wind_direction_text": current.get('wind_dir'),
            "last_updated": current.get('last_updated')
        }

        return jsonify(wind_data)

    except requests.exceptions.RequestException as e:
        print(f"ERROR: Could not fetch from WeatherAPI.com: {e}")
        return jsonify({"error": "Failed to fetch weather data"}), 500


@app.route('/api/global-prediction', methods=['GET'])
def get_global_prediction():
    """
    Conceptual Global ML Prediction: Fetches current plumes and simulates a global shift 
    based on a conceptual ML model trained on average global wind patterns.
    
    NOTE: This endpoint is conceptual. It returns the current plumes (red) AND
    a simulated 24-hour shifted version (blue) to represent the ML prediction.
    """
    
    # 1. Fetch current global plumes
    carbonmapper_response = get_carbonmapper_plumes()
    
    if carbonmapper_response.status_code != 200:
        return carbonmapper_response # Return the error response directly

    plume_data = carbonmapper_response.get_json()

    # --- SIMULATED PREDICTION LOGIC ---
    # Global average wind is generally East/Northeast.
    SIMULATED_SHIFT_DEGREES_LAT = 0.5 
    SIMULATED_SHIFT_DEGREES_LON = 1.5

    predicted_features = []
    
    for feature in plume_data.get('features', []):
        if feature['geometry']['type'] == 'Point':
            lon, lat = feature['geometry']['coordinates']
            
            predicted_lon = lon + SIMULATED_SHIFT_DEGREES_LON
            predicted_lat = lat + SIMULATED_SHIFT_DEGREES_LAT
            
            predicted_feature = feature.copy()
            predicted_feature['properties'] = feature['properties'].copy()
            predicted_feature['properties']['plume_id'] = f"PREDICTED-{feature['properties']['plume_id']}"
            predicted_feature['properties']['is_predicted'] = True
            
            predicted_feature['geometry']['coordinates'] = [predicted_lon, predicted_lat]
            predicted_features.append(predicted_feature)
            
    # Combine original features (current plumes) and predicted features (shifted plumes)
    combined_features = plume_data.get('features', []) + predicted_features
    
    return jsonify({
        "type": "FeatureCollection",
        "features": combined_features
    })


if __name__ == '__main__':
    # Ensure timezone is available for Flask's built-in run command
    if not hasattr(datetime, 'timezone'):
         import zoneinfo
         datetime.timezone = zoneinfo.ZoneInfo("UTC")

    app.run(debug=True, port=5000)