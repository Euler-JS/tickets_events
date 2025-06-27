require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

// Importar rotas
const authRoutes = require('./routes/auth');
const venueRoutes = require('./routes/venues');
const eventRoutes = require('./routes/events');
const bookingRoutes = require('./routes/bookings');
const userRoutes = require('./routes/users');
const path = require('path');

const uploadRoutes = require('./routes/upload');

// Importar middleware - CORRIGIDO
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { authenticate } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Muitas tentativas. Tente novamente mais tarde.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware global
app.use(helmet());
// CORS
app.use(cors({
  origin: true, // Aceita qualquer origem
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));
// Middlewares de segurança
app.use(
 helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'",
      "https://unpkg.com",
      "https://cdnjs.cloudflare.com" // ✅ ADICIONE ISSO AQUI
    ],
    scriptSrcAttr: ["'unsafe-inline'"],
    styleSrc: [
      "'self'",
      "'unsafe-inline'",
      "https://fonts.googleapis.com",
      "https://cdnjs.cloudflare.com"
    ],
    fontSrc: [
      "'self'",
      "https://fonts.gstatic.com",
      "https://unpkg.com",
      "https://fonts.googleapis.com",
      "https://cdnjs.cloudflare.com"
    ],
    imgSrc: ["'self'", "data:","https://i.ibb.co","https://wlcngasdkisqfhaigkgb.supabase.co"],
    connectSrc: ["'self'", "https://unpkg.com"],
  }
})

);
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(limiter);

app.use(cookieParser());
app.use(authenticate);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Rota para página inicial
app.get('/start', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'start.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.status(204).end();
});

// Rota raiz
app.get('/', (req, res) => {
  // res.json({
  //   message: 'Restaurant Menu API with User Management',
  //   version: process.env.API_VERSION || 'v1',
  //   documentation: '/api/docs',
  //   health: '/health',
  //   admin: '/admin',
  //   login: '/login',
  //   start: '/start',
  //   endpoints: {
  //     auth: '/api/v1/auth',
  //     users: '/api/v1/users',
  //     restaurants: '/api/v1/restaurants',
  //     categories: '/api/v1/categories',
  //     products: '/api/v1/products',
  //     menu: '/api/v1/menu'
  //   }
  // });
  res.redirect('/start');
});

// Rotas públicas
app.use('/api/auth', authRoutes);
// Rotas públicas temporariamente
// app.use('/api/events', eventRoutes);


// Rotas protegidas
app.use('/api/venues', authenticate, venueRoutes);
app.use('/api/events', authenticate, eventRoutes);
// app.use('/api/bookings', authenticate, bookingRoutes);
app.use('/api/bookings',bookingRoutes);
app.use('/api/users', authenticate, userRoutes);

app.use('/api/upload', uploadRoutes);

// Middleware para rotas não encontradas
app.use(notFound);

// Middleware de tratamento de erros (deve ser o último)
app.use(errorHandler);

// Tratamento de erros não capturados
process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API Base: http://localhost:${PORT}/api`);
});

module.exports = app;