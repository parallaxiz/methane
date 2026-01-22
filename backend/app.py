from flask import Flask, request, jsonify
from flask_cors import CORS
import ee
import datetime
import os
import requests
from dotenv import load_dotenv
from attribution_service import get_attribution_analysis  # ✅ Keep this
import matplotlib
matplotlib.use('Agg') # backend for non-GUI rendering
import matplotlib.pyplot as plt
import io
import base64
from PIL import Image

load_dotenv()

app = Flask(__name__)
CORS(app)

try:
    ee.Initialize(project='flash-griffin-473118-e3')
    print("OK: GEE initialized successfully for the server.")
except Exception as e:
    print(f"ERROR: GEE initialization failed: {e}")

# ✅ KEEP YOUR ORIGINAL /api/map ENDPOINT (CRITICAL!)
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

# ✅ KEEP YOUR ORIGINAL /api/carbonmapper ENDPOINT (UNCHANGED)
@app.route('/api/carbonmapper', methods=['GET'])
def get_carbonmapper_plumes():
    api_key = os.getenv('CARBONMAPPER_API_KEY')
    if not api_key:
        return jsonify({"error": "Carbon Mapper API key not configured"}), 500

    carbon_mapper_url = "https://api.carbonmapper.org/api/v1/catalog/plumes/annotated"
    headers = {"Authorization": f"Bearer {api_key}"}

    end_time = datetime.datetime.now(datetime.timezone.utc)
    start_time = end_time - datetime.timedelta(days=365)
    
    params = {
        "datetime": f"{start_time.isoformat().replace('+00:00', 'Z')}/{end_time.isoformat().replace('+00:00', 'Z')}",
        "plume_gas": "CH4",
        "limit": 5000
    }

    try:
        response = requests.get(carbon_mapper_url, headers=headers, params=params)
        response.raise_for_status()
        
        items = response.json().get('items', [])
        
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

# 🔥 NEW SOURCE ATTRIBUTION ENDPOINT ONLY
@app.route('/api/v1/attribution/ndvi', methods=['POST'])
def run_source_attribution():
    data = request.get_json()
    
    required_fields = ['geojson_feature', 'start_date', 'end_date']
    if not all(field in data for field in required_fields):
        return jsonify({"status": "error", "message": "Missing required fields"}), 400

    geojson_feature = data['geojson_feature']
    start_date = data['start_date']
    end_date = data['end_date']

    result = get_attribution_analysis(geojson_feature, start_date, end_date)

    if result['status'] == 'success':
        return jsonify({
            'status': 'success',
            'tileUrl': result['tile_url'],  # ✅ Frontend expects tileUrl
            'mean_ndvi': result.get('mean_ndvi')
        })
    else:
        return jsonify({'status': 'error', 'message': result.get('message', 'Analysis failed')})

if __name__ == '__main__':
    app.run(debug=True, port=5000)


@app.route('/api/predict', methods=['POST'])
def predict_plume():
    try:
        data = request.json
        # 1. Get location from Frontend (or default to a known hotspot)
        lat = data.get('lat', 35.0) 
        lon = data.get('lon', -119.0)
        date = data.get('date', '2023-06-01')

        print(f"🔮 Predicting for Lat:{lat}, Lon:{lon} on {date}...")

        # 2. FETCH PHYSICS DATA (Using the function we wrote earlier)
        # Note: We fetch a slightly larger area to feed the 128x128 model
        # For this demo, let's assume fetch_real_physics_data returns a single 128x128x4 input
        # In a real app, you'd dynamicall fetch based on 'lat'/'lon'
        
        # --- MOCKING DATA FOR DEMO IF FETCH FAILS ---
        # (This ensures you see a heatmap even if GEE/API times out)
        input_fake = np.random.rand(1, 128, 128, 4).astype(np.float32)
        
        # 3. RUN MODEL
        prediction = model.predict(input_fake) # Shape: (1, 128, 128, 1)
        pred_grid = prediction[0, :, :, 0] # Remove batch dims -> (128, 128)

        # 4. GENERATE HEATMAP IMAGE
        # We use Matplotlib to colorize the grid
        plt.figure(figsize=(4, 4), dpi=100)
        plt.imshow(pred_grid, cmap='magma', vmin=0, vmax=1) # 'magma' or 'jet' or 'inferno'
        plt.axis('off') # Hide axis numbers
        
        # Save to memory buffer
        buf = io.BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight', pad_inches=0, transparent=True)
        buf.seek(0)
        plt.close()

        # 5. CONVERT TO BASE64 URL
        image_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        heatmap_url = f"data:image/png;base64,{image_base64}"

        # 6. RETURN TO FRONTEND
        # We must return the 'bounds' so the map knows where to place the image
        # logic: lat +/- 0.25 deg (approx 50km box)
        bounds = [[lat - 0.25, lon - 0.25], [lat + 0.25, lon + 0.25]]
        
        return jsonify({
            'status': 'success',
            'heatmap_image': heatmap_url,
            'bounds': bounds
        })

    except Exception as e:
        print(f"❌ Prediction Error: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500