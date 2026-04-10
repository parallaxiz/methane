# Methane Mapper

A full-stack geographic web application designed to track, visualize, attribute, and predict methane emissions and plumes using satellite imagery, the Carbon Mapper API, and custom deep learning models.

## Features

- **Global Methane Visualization**: Integrates with Google Earth Engine (GEE) and Copernicus Sentinel-5P data to map global methane concentrations and background thresholds in real-time.
- **High-Resolution Plume Tracking**: Fetches and visualizes annotated methane plumes directly from the Carbon Mapper API.
- **Source Attribution**: Analyzes environmental factors (like NDVI) to attribute methane anomalies to potential specific sources.
- **AI-Powered Plume Prediction**: Employs a custom-trained physics-based deep learning model (`methane_4ch_physics_model.h5`) to predict methane plume dispersion based on geographical targets and timelines, using heatmaps.

## Tech Stack

**Frontend:**
- **React.js**: For interactive user interfaces.
- **Leaflet & React-Leaflet**: To render dynamic bounding boxes, tile layers, and prediction maps.
- **Material UI (MUI)**: For sleek, modern UI components.

**Backend:**
- **Python & Flask**: Powers the REST API handling complex planetary analysis.
- **Google Earth Engine API**: Queries planetary-scale satellite imagery efficiently.
- **TensorFlow/Keras**: Runs the predictive AI models to generate dispersion heatmaps.
- **PIL & Matplotlib**: Renders the AI predictions into visual heatmap overlays.

## Setup Instructions

### Prerequisites
- Node.js (v16+ recommended)
- Python (3.8+ recommended)
- Google Earth Engine Account & Authentication
- Carbon Mapper API key

### Installation

1. **Clone the repository** and navigate to the project root:
   ```bash
   git clone <repo-url>
   cd methane-mapper
   ```

2. **Install root dependencies** (uses `concurrently` to run both servers):
   ```bash
   npm install
   ```

3. **Install frontend dependencies**:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. **Install backend dependencies**:
   ```bash
   cd backend
   pip install flask flask-cors earthengine-api requests python-dotenv matplotlib pillow numpy
   # Ensure you install TensorFlow/Keras if required by the prediction model
   cd ..
   ```

5. **Set Environment Variables**:
   Create a `.env` file inside the `backend` directory:
   ```env
   CARBONMAPPER_API_KEY=your_carbon_mapper_api_key
   ```
   *Note: Ensure your local environment is authenticated with Google Earth Engine (e.g., via `earthengine authenticate`). The backend is currently configured to connect to the GEE project `flash-griffin-473118-e3`.*

## Running the Application

You can spin up both the React frontend and the Flask API backend with a single command from the root directory:

```bash
npm start
```

This command leverages `concurrently` to run:
- Backend: `http://localhost:5000`
- Frontend: Typically `http://localhost:3000`

## Project Structure

- `/frontend`: The React application containing interactive maps, dashboards, and API communication services.
- `/backend`: The Flask server, which houses the Earth Engine logic, Carbon Mapper integrations, `attribution_service.py`, and AI model inference scripts (`app.py`).
- `package.json`: Root package dictating concurrently run scripts.
