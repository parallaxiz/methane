import numpy as np
import matplotlib
import matplotlib.pyplot as plt
import io
import base64
import tensorflow as tf
from tensorflow.keras.models import load_model # type: ignore

# Use non-interactive backend for server stability
matplotlib.use('Agg')

# Global variable to hold the model once loaded
_model = None

def load_trained_model(model_path='model/methane_unet.h5'):
    """
    Loads the trained U-Net model from the file system.
    """
    global _model
    try:
        if _model is None:
            print(f"Loading model from {model_path}...")
            # If you saved your model in the notebook using model.save('...'), load it here
            _model = load_model(model_path)
            print("Model loaded successfully.")
    except Exception as e:
        print(f"ERROR: Could not load model. Ensure '{model_path}' exists. {e}")
        return None
    return _model

def rasterize_plumes_to_grid(plumes, grid_size=(128, 128), bounds=None):
    """
    Converts list of plume dictionaries (lat, lon, rate) into a 128x128 numpy tensor.
    
    bounds: tuple ((min_lat, min_lon), (max_lat, max_lon))
    If bounds are None, it defaults to the whole world (Global View).
    """
    # Default to global bounds if none provided: [[-90, -180], [90, 180]]
    if bounds is None:
        min_lat, min_lon = -90, -180
        max_lat, max_lon = 90, 180
    else:
        (min_lat, min_lon), (max_lat, max_lon) = bounds

    # Create empty grid
    grid = np.zeros(grid_size, dtype=np.float32)
    
    lat_step = (max_lat - min_lat) / grid_size[0]
    lon_step = (max_lon - min_lon) / grid_size[1]

    if not plumes:
        return grid

    for plume in plumes:
        try:
            # Extract coordinates and emission rate
            coords = plume.get('geometry', {}).get('coordinates', []) # [lon, lat]
            props = plume.get('properties', {})
            rate = props.get('emission_auto', 0)

            if len(coords) == 2 and rate > 0:
                lon, lat = coords
                
                # Check if inside bounds
                if min_lat <= lat < max_lat and min_lon <= lon < max_lon:
                    # Map to grid indices
                    # Note: Image origin is usually top-left, map is bottom-left. We flip Y later or logic here.
                    # Standard logic: y = (lat - min_lat) / step
                    
                    grid_y = int((lat - min_lat) / lat_step)
                    grid_x = int((lon - min_lon) / lon_step)

                    # Boundary check just in case
                    grid_y = min(max(grid_y, 0), grid_size[0] - 1)
                    grid_x = min(max(grid_x, 0), grid_size[1] - 1)

                    # Add emission rate to pixel (Accumulate density)
                    grid[grid_y, grid_x] += rate
        except Exception as e:
            continue # Skip bad plume data

    # Normalize grid to 0-1 range for the Neural Network
    if np.max(grid) > 0:
        grid = grid / np.max(grid)
        
    return grid

def generate_heatmap_image(prediction_grid):
    """
    Converts the 128x128 output tensor into a transparent PNG base64 string.
    """
    plt.figure(figsize=(4, 4), dpi=128)
    plt.axis('off')
    
    # Flip grid for correct map orientation (Matplotlib vs Geospatial coords)
    # Usually satellite data needs origin='lower'
    
    # Clip values for alpha channel
    alpha_channel = np.clip(prediction_grid, 0, 1)
    
    # Render with 'plasma' colormap (High contrast)
    plt.imshow(prediction_grid, cmap='plasma', origin='lower', alpha=alpha_channel)
    
    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', pad_inches=0, transparent=True)
    buf.seek(0)
    image_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
    plt.close()
    
    return f"data:image/png;base64,{image_base64}"

def run_global_prediction(plumes_data):
    """
    Main orchestration function.
    1. Rasterizes all real plumes.
    2. Feeds into Model.
    3. Returns Heatmap.
    """
    model = load_trained_model()
    
    # 1. Rasterize Global Data (Map all plumes to 128x128 world grid)
    # Bounds: South-West (-90, -180) to North-East (90, 180)
    global_bounds = ((-90, -180), (90, 180))
    
    input_tensor = rasterize_plumes_to_grid(plumes_data, bounds=global_bounds)
    
    # Reshape for model input: (1, 128, 128, 1)
    input_batch = np.expand_dims(input_tensor, axis=0)
    input_batch = np.expand_dims(input_batch, axis=-1)

    # 2. Predict
    if model:
        prediction = model.predict(input_batch)
        # Output shape is likely (1, 128, 128, 1), squeeze back to (128, 128)
        output_grid = np.squeeze(prediction)
    else:
        # Fallback if no model file exists yet (simulates prediction for demo)
        print("WARNING: Using simulation fallback (Model not found)")
        output_grid = input_tensor # Just return input as "prediction" for testing
    
    # 3. Generate Image
    heatmap_url = generate_heatmap_image(output_grid)
    
    return {
        "heatmap_image": heatmap_url,
        "bounds": [[-90, -180], [90, 180]] # Global bounds for Leaflet
    }