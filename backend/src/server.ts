import express from 'express';
import cors from 'cors';
import { ENV } from './config/env';
import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import salesRouter from './routes/sales';
import mapRouter from './routes/map';
import dashboardRouter from './routes/dashboard';

const app = express();

// ── Middleware ───────────────────────────────────────────
app.use(cors({ origin: ENV.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health Check ───────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: ENV.NODE_ENV, timestamp: new Date().toISOString() });
});

// ── Routes ─────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/sales', salesRouter);
app.use('/api/map', mapRouter);
app.use('/api/dashboard', dashboardRouter);

// ── 404 Handler ───────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ── Start Server ──────────────────────────────────────
app.listen(ENV.PORT, () => {
  console.log(`🚀 Server running on port ${ENV.PORT} [${ENV.NODE_ENV}]`);
  console.log(`   Health: http://localhost:${ENV.PORT}/health`);
});

export default app;
