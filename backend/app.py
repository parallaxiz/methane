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

@app.route('/api/map', methods=['GET'])
def get_methane_map():
    background_threshold = int(request.args.get('threshold', 1920))
    selected_date_str = request.args.get('date')
    
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

    return jsonify({
        'tileUrl': map_info['tile_fetcher'].url_format
    })


@app.route('/api/carbonmapper', methods=['GET'])
def get_carbonmapper_plumes():
    api_key = os.getenv('CARBONMAPPER_API_KEY')
    if not api_key:
        return jsonify({"error": "Carbon Mapper API key not configured on the server"}), 500

    carbon_mapper_url = "https://api.carbonmapper.org/api/v1/plumes"
    headers = { 
        "Authorization": f"Bearer {api_key}"
    }

    # --- FIX: Add a date range to the request to make it more specific ---
    end_date = datetime.datetime.now()
    start_date = end_date - datetime.timedelta(days=365) # Look for plumes in the last year

    params = {
        # Bounding box for California as a comma-separated string
        "bbox": "-124.5,31.5,-114.5,41.5",
        # Add start and end dates in the required format
        "start_date": start_date.strftime('%Y-%m-%d'),
        "end_date": end_date.strftime('%Y-%m-%d')
    }

    try:
        response = requests.get(carbon_mapper_url, headers=headers, params=params)
        response.raise_for_status() # Raise an error for bad responses (4xx or 5xx)
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Could not fetch from Carbon Mapper API: {e}")
        return jsonify({"error": "Failed to fetch data from Carbon Mapper"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)

