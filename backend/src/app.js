const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./routes/authRoutes');
const aiRoutes = require('./routes/aiRoutes');
const userRoutes = require('./routes/userRoutes');
const listingRoutes = require('./routes/listingRoutes');
const mlRoutes = require('./routes/mlRoutes');
const matchingRoutes = require('./routes/matchingRoutes');
const auctionRoutes = require('./routes/auctionRoutes');
const pickupRoutes = require('./routes/pickupRoutes');
const agentRoutes = require('./routes/agentRoutes');

const errorHandler = require('./middleware/errorHandler');

const app = express();

const port =
  process.env.PORT || 5000;

/*
 * CORS
 *
 * FRONTEND_URL may be a single origin or a comma-separated list of
 * origins (useful for a Netlify prod URL + deploy previews + local dev).
 * If FRONTEND_URL is not set, all origins are reflected (previous
 * behavior), so this is fully backward compatible for local dev.
 */
const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin:
      allowedOrigins.length > 0
        ? allowedOrigins
        : true,
    credentials: true
  })
);

// Real listing photos are persisted as `data:` URLs (see
// SellPage.handleStartResolution / frontend/src/utils/fileToImageInput.js)
// and the agent's inspect stage replays that same base64 payload into
// POST /agent/advance — both go through this JSON body, which express's
// 100kb default silently rejects (413) for anything but a tiny photo.
// 20mb comfortably covers a normal phone photo (~2-6MB) once base64's
// ~33% overhead is included.
app.use(express.json({ limit: '20mb' }));


app.get(
  '/api/health',
  (req, res) => {
    return res.json({
      success: true,

      service:
        'Punarchakra API',

      mlService:
        process.env.ML_SERVICE_URL ||
        'http://127.0.0.1:8000'
    });
  }
);


/*
 * ROUTES
 */

app.use(
  '/api/auth',
  authRoutes
);

app.use(
  '/api/ai',
  aiRoutes
);

app.use(
  '/api/listings',
  listingRoutes
);

app.use(
  '/api/ml',
  mlRoutes
);

app.use(
  '/api',
  userRoutes
);

app.use(
  '/api/matching',
  matchingRoutes
);

app.use(
  '/api/auction',
  auctionRoutes
);

app.use(
  '/api/pickups',
  pickupRoutes
);

app.use(
  '/api/agent',
  agentRoutes
);


/*
 * 404 HANDLER
 *
 * IMPORTANT:
 * This MUST come after all routes.
 */

app.use(
  (req, res) => {
    return res
      .status(404)
      .json({
        success: false,

        message:
          'Route not found',

        data: null
      });
  }
);


/*
 * ERROR HANDLER
 *
 * MUST stay last.
 */

app.use(
  errorHandler
);


app.listen(
  port,
  () => {
    console.log(
      `Punarchakra API listening on http://localhost:${port}`
    );

    console.log(
      `ML service: ${
        process.env.ML_SERVICE_URL ||
        'http://127.0.0.1:8000'
      }`
    );
  }
);