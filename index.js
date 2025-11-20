// MUST BE FIRST LINE - Load environment variables
require('dotenv').config();

console.log('=========================');
console.log('ENVIRONMENT VARIABLES CHECK');
console.log('=========================');
console.log('PORT:', process.env.PORT);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('JWT_SECRET present:', !!process.env.JWT_SECRET);
console.log('JWT_SECRET value:', process.env.JWT_SECRET);
console.log('=========================\n');

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const routes = require('./src/routes');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static('public'));

// API routes
app.use('/api', routes);

// error handler
app.use((err, req, res, next) => {
  console.error('[ERROR HANDLER]', err);
  res.status(500).json({ error: err.message || 'Server error' });
});

if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log('✅ Ready to accept requests\n');
  });
}

module.exports = app;