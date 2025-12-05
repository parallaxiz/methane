import ee
import os
import json
from datetime import datetime

# --- CONFIGURATION ---
# Best practice for production: use environment variables for service credentials.
# The user must set the GOOGLE_APPLICATION_CREDENTIALS environment variable
# pointing to their service account JSON key file.
SERVICE_ACCOUNT_EMAIL = os.environ.get("GEE_SERVICE_ACCOUNT_EMAIL", None)
PROJECT_ID = os.environ.get("GEE_PROJECT_ID", None)

def initialize_gee():
    """
    Initializes the Google Earth Engine API using service account credentials
    if available, falling back to anonymous or default credentials.
    This logic should be called once when the application starts.
    """
    if SERVICE_ACCOUNT_EMAIL and PROJECT_ID:
        try:
            # Use service account flow for production environments
            credentials = ee.ServiceAccountCredentials(
                SERVICE_ACCOUNT_EMAIL,
                # Assumes the service account JSON key file path is in 
                # GOOGLE_APPLICATION_CREDENTIALS
                key_file=os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
            )
            ee.Initialize(credentials, project=PROJECT_ID)
            print("GEE initialized successfully with Service Account.")
            return True
        except Exception as e:
            print(f"Service Account GEE Initialization failed: {e}")
            return False
    else:
        # Fallback for local development if credentials were set up via CLI
        try:
            ee.Initialize(project=PROJECT_ID) # project is still recommended
            print("GEE initialized successfully with default credentials.")
            return True
        except Exception as e:
            print(f"Default GEE Initialization failed: {e}. Please run 'earthengine authenticate'.")
            return False

# Call initialization logic immediately when the module is imported
# In a real app, this should only be called once during startup.
# NOTE: If running this script directly, uncomment the line below:
# initialize_gee()


def get_attribution_analysis(geojson_feature, start_date, end_date):
    """
    Performs a sample attribution analysis (mean NDVI) over a given region 
    and time range.

    Args:
        geojson_feature (dict): A GeoJSON Feature dictionary defining the Area of Interest (AOI).
        start_date (str): Start date for the image collection filter (e.g., '2023-01-01').
        end_date (str): End date for the image collection filter (e.g., '2023-12-31').

    Returns:
        dict: A dictionary containing the analysis result (mean NDVI) and a map tile URL.
    """
    try:
        # 1. Define the Area of Interest (AOI)
        # Convert GeoJSON to Earth Engine Geometry
        aoi = ee.Geometry(geojson_feature['geometry'])

        # 2. Define the Image Collection (Sentinel-2)
        # Using cloud-filtered and atmospherically corrected Sentinel-2 MSI data
        collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
            .filterDate(start_date, end_date) \
            .filterBounds(aoi)

        # 3. Cloud Masking Function (Simplified for demonstration)
        def mask_s2_clouds(image):
            # QAT bit 10 is 'Clouds', bit 11 is 'Cirrus'
            qa = image.select('QA60')
            cloud_bit_mask = 1 << 10
            cirrus_bit_mask = 1 << 11
            mask = qa.bitwiseAnd(cloud_bit_mask).eq(0).And(
                   qa.bitwiseAnd(cirrus_bit_mask).eq(0))
            return image.updateMask(mask).divide(10000).select(['B4', 'B8'])
        
        # 4. Apply cloud mask and calculate NDVI
        def add_ndvi(image):
            # Use NIR (B8) and Red (B4) bands
            ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
            return image.addBands(ndvi)

        # Apply functions to the collection
        masked_collection = collection.map(mask_s2_clouds).map(add_ndvi)

        # 5. Compute the median NDVI over the time period
        median_image = masked_collection.select('NDVI').median().clip(aoi)

        # 6. Extract the mean NDVI value for the AOI (Data Attribution)
        # Use a nominal scale (resolution) in meters
        stats = median_image.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=aoi,
            scale=30, # Sentinel-2 resolution is 10-20m, use 30m for efficiency
            maxPixels=1e9
        )
        mean_ndvi = stats.get('NDVI').getInfo()
        
        # 7. Generate a Map Tile URL for visualization (Visual Attribution)
        vis_params = {
            'min': 0.0, 
            'max': 1.0, 
            'palette': ['FF0000', 'F0FF00', '00FF00'] # Red (low) to Green (high)
        }
        
        map_id_dict = median_image.getMapId(vis_params)
        tile_url = map_id_dict['tile_fetcher'].url_format
        
        return {
            "mean_ndvi": mean_ndvi,
            "tile_url": tile_url,
            "vis_params": vis_params,
            "status": "success"
        }

    except Exception as e:
        # Handle GEE-specific or general errors
        error_message = f"GEE computation error: {e}"
        print(error_message)
        return {
            "mean_ndvi": None,
            "tile_url": None,
            "status": "error",
            "message": error_message
        }