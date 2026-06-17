import { Router, Request, Response } from 'express';
import db from '../db.js';
import { hashPassword, comparePassword, signToken } from '../auth.js';

const router = Router();

router.post('/register', (req: Request, res: Response) => {
  try {
    const { username, password, name, role, phone } = req.body;
    if (!username || !password || !name || !role) {
      res.status(400).json({ error: '请填写所有必填字段' });
      return;
    }
    if (!['courier', 'recipient', 'admin'].includes(role)) {
      res.status(400).json({ error: '无效的角色类型' });
      return;
    }
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      res.status(409).json({ error: '用户名已存在' });
      return;
    }
    const hashedPassword = hashPassword(password);
    const result = db.prepare(
      'INSERT INTO users (username, password, name, role, phone) VALUES (?, ?, ?, ?, ?)'
    ).run(username, hashedPassword, name, role, phone || null);

    const token = signToken({ userId: result.lastInsertRowid as number, role, username });
    res.status(201).json({
      token,
      user: { id: result.lastInsertRowid, username, name, role, phone }
    });
  } catch (err: any) {
    res.status(500).json({ error: '注册失败: ' + err.message });
  }
});

router.post('/login', (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: '请输入用户名和密码' });
      return;
    }
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    if (!user) {
      res.status(401).json({ error: '用户名或密码错误' });
      return;
    }
    if (!comparePassword(password, user.password)) {
      res.status(401).json({ error: '用户名或密码错误' });
      return;
    }
    const token = signToken({ userId: user.id, role: user.role, username: user.username });
    res.json({
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role, phone: user.phone }
    });
  } catch (err: any) {
    res.status(500).json({ error: '登录失败: ' + err.message });
  }
});

router.get('/me', (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: '请先登录' });
      return;
    }
    const user = db.prepare('SELECT id, username, name, role, phone FROM users WHERE id = ?').get(req.user.userId) as any;
    if (!user) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }
    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
