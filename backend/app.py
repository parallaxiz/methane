from flask import Flask, request, jsonify
from flask_cors import CORS
import ee
import datetime
import os
import requests
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

try:
    ee.Initialize(project='flash-griffin-473118-e3')
    print("OK: GEE initialized successfully for the server.")
except Exception as e:
    print(f"ERROR: GEE initialization failed: {e}")

# This endpoint is kept but will not be used by the new map page
@app.route('/api/map', methods=['GET'])
def get_methane_map():
    background_threshold = int(request.args.get('threshold', 1920))
    selected_date_str = request.args.get('date')
    center_lon = -119.5
    center_lat = 36.5
    filter_point = ee.Geometry.Point(center_lon, center_lat)
    methane_collection = ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_CH4').select('CH4_column_volume_mixing_ratio_dry_air').filterBounds(filter_point)
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
    spot_style = {'min': background_threshold, 'max': peak_threshold, 'palette': ['#8B0000', '#FF0000']}
    map_info = methane_spots.getMapId(spot_style)
    return jsonify({'tileUrl': map_info['tile_fetcher'].url_format})


# --- UPDATED: This endpoint now fetches GLOBAL plume data ---
@app.route('/api/carbonmapper', methods=['GET'])
def get_carbonmapper_plumes():
    api_key = os.getenv('CARBONMAPPER_API_KEY')
    if not api_key:
        return jsonify({"error": "Carbon Mapper API key not configured"}), 500

    carbon_mapper_url = "https://api.carbonmapper.org/api/v1/catalog/plumes/annotated"
    headers = {"Authorization": f"Bearer {api_key}"}

    end_time = datetime.datetime.now(datetime.timezone.utc)
    start_time = end_time - datetime.timedelta(days=365) # Last year of data
    
    # --- CHANGE: Removed 'bbox' to get global data ---
    params = {
        "datetime": f"{start_time.isoformat().replace('+00:00', 'Z')}/{end_time.isoformat().replace('+00:00', 'Z')}",
        "plume_gas": "CH4",
        "limit": 5000 # Limit to 5000 plumes to keep it fast
    }

    try:
        response = requests.get(carbon_mapper_url, headers=headers, params=params)
        response.raise_for_status()
        
        items = response.json().get('items', [])
        
        # Reformat the data into valid GeoJSON that Leaflet can understand
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

if __name__ == '__main__':
    app.run(debug=True, port=5000)

