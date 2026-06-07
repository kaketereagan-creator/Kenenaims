require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use('/api/', limiter);

// All routes
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/dashboard',     require('./routes/dashboard'));
app.use('/api/animals',       require('./routes/animals'));
app.use('/api/wallet',        require('./routes/wallet'));
app.use('/api/payroll',       require('./routes/payroll'));
app.use('/api/inventory',     require('./routes/inventory'));
app.use('/api/finance',       require('./routes/finance'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/crops',         require('./routes/crops'));
app.use('/api/tasks',         require('./routes/tasks'));

// Health check
app.get('/health', (req, res) => res.json({
  status: 'ok', farm: 'Kenena Farm', version: '2.0.0',
  time: new Date().toISOString(), uptime: process.uptime()
}));

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, req, res, next) => { console.error(err.stack); res.status(500).json({ error: 'Server error' }); });

app.listen(PORT, () => {
  console.log(`✅ KFMS API v2.0 → http://localhost:${PORT}`);
  console.log(`🌿 Kenena Farm Management System — Kihura, Uganda`);

  // Start notification cron jobs
  try {
    const { startNotificationJobs } = require('./services/notifications');
    startNotificationJobs();
  } catch (e) {
    console.log('[Notifications] Cron jobs skipped (missing deps)');
  }
});

module.exports = app;
