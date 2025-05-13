const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS
app.use(cors({
  exposedHeaders: ['Content-Disposition'] // Important for file downloads
}));
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Roboflow configuration
const ROBOFLOW_API_KEY = "Sm8mwEjQnsfj41HKoJq9";
const ROBOFLOW_MODEL_URL = "https://detect.roboflow.com/wind-8p7de/2";

// Make uploads directory accessible
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const db = new sqlite3.Database('windmill_damage.db');

// Helper function to log requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Function to ensure database table exists
function ensureDatabaseSetup() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create windmill damage reports table
      db.run(`CREATE TABLE IF NOT EXISTS damage_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        windmill_number TEXT,
        damage TEXT,
        location TEXT,
        image_path TEXT,
        type TEXT DEFAULT 'windmill',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          console.error('Windmill database setup error:', err);
          reject(err);
          return;
        }
        
        // Create solar panel reports table
        db.run(`CREATE TABLE IF NOT EXISTS solar_panel_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          panel_id TEXT,
          damage TEXT,
          location TEXT,
          image_path TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) {
            console.error('Solar panel database setup error:', err);
            reject(err);
            return;
          }
          
          resolve();
        });
      });
    });
  });
}

// Initialize database on startup
ensureDatabaseSetup()
  .then(() => {
    console.log('Database initialized successfully');
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
  });

// Endpoint to handle image uploads and predictions
app.post('/predict', upload.single('image'), async (req, res) => {
  try {
    const { windmillNumber, location, type } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    
    if (!windmillNumber) {
      return res.status(400).json({ error: 'Windmill number is required' });
    }
    
    if (!location) {
      return res.status(400).json({ error: 'Location is required' });
    }
    
    const inspectionType = type || 'windmill'; // Default to windmill if not specified
    
    console.log('Processing prediction for windmill:', windmillNumber);
    console.log('Image path:', req.file.path);
    
    // For testing purposes, just assume there is damage
    const hasDamage = true;
    const predictions = [{
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      confidence: 0.95,
      class: "damage"
    }];
    
    // Store result in database
    const result = {
      windmill_number: windmillNumber,
      damage: hasDamage ? 'Yes' : 'No',
      location: location,
      image_path: req.file.path,
      timestamp: new Date().toISOString(),
    };
    
    console.log('Inserting into database:', result);
    
    // Insert into the appropriate table
    if (inspectionType === 'solar') {
      db.run(
        `INSERT INTO solar_panel_reports (panel_id, damage, location, image_path) VALUES (?, ?, ?, ?)`,
        [windmillNumber, result.damage, location, req.file.path],
        function(err) {
          if (err) {
            console.error('Database insert error:', err);
            return res.status(500).json({ error: 'Database error', details: err.message });
          }
          
          // Send response to client
          res.json({
            windmillNumber: windmillNumber,
            location: location,
            damage: result.damage,
            timestamp: result.timestamp,
            predictions: predictions
          });
        }
      );
    } else {
      db.run(
        `INSERT INTO damage_reports (windmill_number, damage, location, image_path, type) VALUES (?, ?, ?, ?, ?)`,
        [windmillNumber, result.damage, location, req.file.path, 'windmill'],
        function(err) {
          if (err) {
            console.error('Database insert error:', err);
            return res.status(500).json({ error: 'Database error', details: err.message });
          }
          
          // Send response to client
          res.json({
            windmillNumber: windmillNumber,
            location: location,
            damage: result.damage,
            timestamp: result.timestamp,
            predictions: predictions
          });
        }
      );
    }
  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({ 
      error: 'Failed to process image', 
      details: error.message 
    });
  }
});

// Reports endpoint with type filter
app.get('/reports', (req, res) => {
  const type = req.query.type || 'windmill';
  
  if (type === 'solar') {
    db.all('SELECT * FROM solar_panel_reports ORDER BY timestamp DESC', (err, rows) => {
      if (err) {
        console.error('Error fetching solar panel reports:', err.message);
        res.status(500).json({ error: 'Failed to fetch reports' });
      } else {
        res.json(rows);
      }
    });
  } else {
    db.all('SELECT id, windmill_number as windmillNumber, damage, location, image_path, timestamp FROM damage_reports WHERE type = ? ORDER BY timestamp DESC', ['windmill'], (err, rows) => {
      if (err) {
        console.error('Error fetching windmill reports:', err.message);
        res.status(500).json({ error: 'Failed to fetch reports' });
      } else {
        console.log('Reports fetched:', rows);
        res.json(rows);
      }
    });
  }
});

// CSV Download endpoint with type filter
app.get('/reports/csv', (req, res) => {
  console.log('CSV download requested');
  const type = req.query.type || 'windmill';
  
  if (type === 'solar') {
    db.all('SELECT * FROM solar_panel_reports ORDER BY timestamp DESC', (err, rows) => {
      if (err) {
        console.error('Error generating solar panel CSV:', err.message);
        res.status(500).send('Failed to fetch reports');
      } else {
        try {
          console.log(`Generating CSV for ${rows.length} solar panel records`);
          
          const header = 'id,panel_id,damage,location,image_path,timestamp\n';
          const csv = rows.map(r => 
            `${r.id},${r.panel_id},${r.damage},"${r.location}","${r.image_path}",${r.timestamp}`
          ).join('\n');
          
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename="solar_panel_reports.csv"');
          res.send(header + csv);
          
          console.log('Solar panel CSV file sent successfully');
        } catch (error) {
          console.error('Error sending CSV:', error);
          res.status(500).send('Error generating CSV file');
        }
      }
    });
  } else {
    db.all('SELECT * FROM damage_reports WHERE type = ? ORDER BY timestamp DESC', ['windmill'], (err, rows) => {
      if (err) {
        console.error('Error generating windmill CSV:', err.message);
        res.status(500).send('Failed to fetch reports');
      } else {
        try {
          console.log(`Generating CSV for ${rows.length} windmill records`);
          
          const header = 'id,windmill_number,damage,location,image_path,timestamp\n';
          const csv = rows.map(r => 
            `${r.id},${r.windmill_number},${r.damage},"${r.location}","${r.image_path}",${r.timestamp}`
          ).join('\n');
          
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename="windmill_damage_reports.csv"');
          res.send(header + csv);
          
          console.log('Windmill CSV file sent successfully');
        } catch (error) {
          console.error('Error sending CSV:', error);
          res.status(500).send('Error generating CSV file');
        }
      }
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
}); 