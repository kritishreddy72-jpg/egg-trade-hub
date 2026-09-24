const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const priceRoutes = require('./routes/prices');
const orderRoutes = require('./routes/orders');
const customerRoutes = require('./routes/customers');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/prices', priceRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Egg Trade API', timestamp: new Date().toISOString() });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Egg Trade Backend running on http://localhost:${PORT}`);
  });
}

module.exports = app;
