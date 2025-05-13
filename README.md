# Drone Detection App

A full-stack application that uses Roboflow's machine learning model to detect drones in images.

## Project Structure

```
drone-detection-app/
├── backend/         # Node.js Express server
└── frontend/        # React frontend application
```

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the backend directory with the following content:
   ```
   PORT=3000
   ROBOFLOW_API_KEY=your_api_key_here
   ROBOFLOW_MODEL_URL=your_model_url_here
   ```

4. Start the backend server:
   ```bash
   node server.js
   ```

The backend server will run on http://localhost:3000

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

The frontend application will run on http://localhost:3000

## Usage

1. Open your browser and navigate to http://localhost:3000
2. Click the "Select Image" button to choose an image containing a drone
3. Click "Analyze Image" to process the image
4. View the prediction results displayed below the image

## Features

- Image upload and preview
- Real-time drone detection using Roboflow's ML model
- Clean and responsive UI using Material-UI
- Error handling and loading states
- Secure API key management

## Technologies Used

- Backend:
  - Node.js
  - Express
  - Multer (for file uploads)
  - Axios (for API requests)
  - CORS (for cross-origin requests)

- Frontend:
  - React
  - Material-UI
  - Axios
  - Modern JavaScript (ES6+) 