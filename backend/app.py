from flask import Flask, request, jsonify
from flask_cors import CORS
import ee
import datetime

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

    methane_data = None # Initialize as None

    if selected_date_str:
        start_date = ee.Date(selected_date_str)
        end_date = start_date.advance(1, 'day')
        # Check if the collection for that day is empty BEFORE creating an image
        daily_collection = methane_collection.filterDate(start_date, end_date)
        if daily_collection.size().getInfo() > 0:
            methane_data = daily_collection.mean()
    else:
        methane_data = methane_collection.sort('system:time_start', False).first()

    # --- NEW CHECK: If methane_data is still None, there's no data ---
    if methane_data is None:
        # Return an empty response so the frontend knows there's no map
        return jsonify({'tileUrl': None, 'message': 'No data available for the selected date.'})

    # --- The rest of your code runs only if there IS data ---
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

if __name__ == '__main__':
    app.run(debug=True, port=5000)