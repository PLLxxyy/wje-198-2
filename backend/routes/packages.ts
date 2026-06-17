import { Router, Request, Response } from 'express';
import db from '../db.js';
import { roleMiddleware } from '../auth.js';

const router = Router();

function generatePickupCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post('/', roleMiddleware('courier', 'admin'), (req: Request, res: Response) => {
  try {
    const { tracking_no, recipient_phone, recipient_name } = req.body;
    if (!tracking_no || !recipient_phone || !recipient_name) {
      res.status(400).json({ error: '请填写快递单号、收件人手机号和姓名' });
      return;
    }
    const existing = db.prepare('SELECT id FROM packages WHERE tracking_no = ?').get(tracking_no);
    if (existing) {
      res.status(409).json({ error: '该快递单号已入库' });
      return;
    }
    const pickup_code = generatePickupCode();
    const result = db.prepare(
      'INSERT INTO packages (tracking_no, recipient_phone, recipient_name, pickup_code, entered_by) VALUES (?, ?, ?, ?, ?)'
    ).run(tracking_no, recipient_phone, recipient_name, pickup_code, req.user!.userId);

    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ package: pkg, message: `入库成功，取件码: ${pickup_code}` });
  } catch (err: any) {
    res.status(500).json({ error: '入库失败: ' + err.message });
  }
});

router.get('/search', roleMiddleware('courier', 'admin'), (req: Request, res: Response) => {
  try {
    const tracking_no = req.query.tracking_no as string;
    if (!tracking_no) {
      res.status(400).json({ error: '请输入快递单号' });
      return;
    }
    const pkg = db.prepare('SELECT * FROM packages WHERE tracking_no = ?').get(tracking_no);
    if (!pkg) {
      res.status(404).json({ error: '未找到该快递' });
      return;
    }
    res.json({ package: pkg });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/my', roleMiddleware('recipient'), (req: Request, res: Response) => {
  try {
    const user = db.prepare('SELECT phone FROM users WHERE id = ?').get(req.user!.userId) as any;
    if (!user?.phone) {
      res.status(400).json({ error: '未绑定手机号' });
      return;
    }
    const packages = db.prepare(
      `SELECT p.*, u.name as entered_by_name
       FROM packages p
       LEFT JOIN users u ON p.entered_by = u.id
       WHERE p.recipient_phone = ?
       ORDER BY p.entered_at DESC`
    ).all(user.phone);
    res.json({ packages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/pickup', roleMiddleware('recipient'), (req: Request, res: Response) => {
  try {
    const { tracking_no, pickup_code } = req.body;
    if (!tracking_no || !pickup_code) {
      res.status(400).json({ error: '请输入快递单号和取件码' });
      return;
    }
    const pkg = db.prepare('SELECT * FROM packages WHERE tracking_no = ?').get(tracking_no) as any;
    if (!pkg) {
      res.status(404).json({ error: '未找到该快递' });
      return;
    }
    if (pkg.status === 'picked_up') {
      res.status(400).json({ error: '该快递已被取走' });
      return;
    }
    if (pkg.pickup_code !== pickup_code) {
      res.status(400).json({ error: '取件码错误' });
      return;
    }
    const user = db.prepare('SELECT phone FROM users WHERE id = ?').get(req.user!.userId) as any;
    if (user?.phone !== pkg.recipient_phone) {
      res.status(403).json({ error: '该快递不属于您' });
      return;
    }
    db.prepare(
      `UPDATE packages SET status = 'picked_up', picked_up_at = datetime('now','localtime'), picked_up_by = ? WHERE id = ?`
    ).run(req.user!.userId, pkg.id);

    const updated = db.prepare('SELECT * FROM packages WHERE id = ?').get(pkg.id);
    res.json({ package: updated, message: '取件成功' });
  } catch (err: any) {
    res.status(500).json({ error: '取件失败: ' + err.message });
  }
});

router.get('/today', roleMiddleware('courier', 'admin'), (req: Request, res: Response) => {
  try {
    const packages = db.prepare(
      `SELECT p.*, u.name as entered_by_name
       FROM packages p
       LEFT JOIN users u ON p.entered_by = u.id
       WHERE date(p.entered_at) = date('now','localtime')
       ORDER BY p.entered_at DESC`
    ).all();
    res.json({ packages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/all', roleMiddleware('admin'), (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const total = (db.prepare('SELECT COUNT(*) as count FROM packages').get() as any).count;
    const packages = db.prepare(
      `SELECT p.*, u.name as entered_by_name, u2.name as picked_up_by_name
       FROM packages p
       LEFT JOIN users u ON p.entered_by = u.id
       LEFT JOIN users u2 ON p.picked_up_by = u2.id
       ORDER BY p.entered_at DESC
       LIMIT ? OFFSET ?`
    ).all(limit, offset);

    res.json({ packages, total, page, limit });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
