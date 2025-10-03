from flask import Flask, request, jsonify
from flask_cors import CORS # To handle requests from the React app
import ee
import datetime

# Initialize Flask App
app = Flask(__name__)
CORS(app) # Enable Cross-Origin Resource Sharing

# Initialize Google Earth Engine
try:
    ee.Initialize(project='flash-griffin-473118-e3')
    print("✅ GEE initialized successfully for the server.")
except Exception as e:
    print(f"❌ GEE initialization failed: {e}")

@app.route('/api/map', methods=['GET'])
def get_methane_map():
    # --- Get parameters from the frontend request ---
    # The 'days' parameter is no longer needed, but the threshold is.
    background_threshold = int(request.args.get('threshold', 1900)) # Note: I've raised the default threshold

    # --- Run your GEE Logic ---
    
    # Define the region of interest
    center_lon = -119.5
    center_lat = 36.5
    filter_point = ee.Geometry.Point(center_lon, center_lat)

    # 1. Get the entire collection and filter it to your area of interest.
    methane_collection = ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_CH4') \
        .select('CH4_column_volume_mixing_ratio_dry_air') \
        .filterBounds(filter_point)

    # 2. Sort the collection by date (newest first) and get the single latest image.
    #    This replaces the .filterDate() and .mean() logic.
    latest_methane_image = methane_collection.sort('system:time_start', False).first()

    # 3. Apply the mask directly to this single, latest image.
    methane_spots = latest_methane_image.updateMask(latest_methane_image.gt(background_threshold))
    
    # Define visualization parameters
    peak_threshold = background_threshold + 100 
    spot_style = {
        'min': background_threshold,
        'max': peak_threshold,
        'palette': ['#8B0000', '#FF0000']
    }

    # --- Generate Map Tiles ---
    map_info = methane_spots.getMapId(spot_style)

    # --- Send the tile URL back to the frontend ---
    return jsonify({
        'tileUrl': map_info['tile_fetcher'].url_format
    })

if __name__ == '__main__':
    # Run the server on port 5000
    app.run(debug=True, port=5000)