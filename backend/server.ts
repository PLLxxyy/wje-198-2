import express from 'express';
import cors from 'cors';
import { initDB } from './db.js';
import { authMiddleware } from './auth.js';
import authRoutes from './routes/auth.js';
import packageRoutes from './routes/packages.js';
import statsRoutes from './routes/stats.js';

const app = express();
const PORT = Number(process.env.PORT) || 3298;

app.use(cors());
app.use(express.json());

initDB();

app.use('/api/auth', authRoutes);
app.use('/api/packages', authMiddleware, packageRoutes);
app.use('/api/stats', authMiddleware, statsRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: '快递驿站管理系统运行中' });
});

app.listen(PORT, () => {
  console.log(`\n  快递驿站管理系统后端已启动`);
  console.log(`  地址: http://localhost:${PORT}`);
  console.log(`  健康检查: http://localhost:${PORT}/api/health\n`);
});
