import { Router, Request, Response } from 'express';
import db from '../db.js';
import { roleMiddleware } from '../auth.js';

const router = Router();

function generatePickupCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function autoExpirePackages(): void {
  db.prepare(`
    UPDATE packages
    SET status = 'expired',
        processed_at = datetime('now','localtime')
    WHERE status = 'pending'
      AND julianday('now','localtime') - julianday(entered_at) > 3
  `).run();
}

function addStorageDaysField(sql: string): string {
  return sql.replace(
    'SELECT p.*',
    `SELECT p.*,
       CAST(julianday('now','localtime') - julianday(p.entered_at) AS INTEGER) as storage_days`
  );
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
    autoExpirePackages();
    const tracking_no = req.query.tracking_no as string;
    if (!tracking_no) {
      res.status(400).json({ error: '请输入快递单号' });
      return;
    }
    const pkg = db.prepare(`
      SELECT p.*,
        CAST(julianday('now','localtime') - julianday(p.entered_at) AS INTEGER) as storage_days
      FROM packages p
      WHERE tracking_no = ?
    `).get(tracking_no);
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
    autoExpirePackages();
    const user = db.prepare('SELECT phone FROM users WHERE id = ?').get(req.user!.userId) as any;
    if (!user?.phone) {
      res.status(400).json({ error: '未绑定手机号' });
      return;
    }
    const packages = db.prepare(
      addStorageDaysField(`
        SELECT p.*, u.name as entered_by_name
        FROM packages p
        LEFT JOIN users u ON p.entered_by = u.id
        WHERE p.recipient_phone = ?
        ORDER BY p.entered_at DESC
      `)
    ).all(user.phone);
    res.json({ packages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/pickup', roleMiddleware('recipient'), (req: Request, res: Response) => {
  try {
    autoExpirePackages();
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
    if (pkg.status === 'expired') {
      res.status(400).json({ error: '该快递已过期，请联系管理员' });
      return;
    }
    if (pkg.status === 'returned' || pkg.status === 'scrapped') {
      res.status(400).json({ error: '该快递已被处理' });
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
    autoExpirePackages();
    const packages = db.prepare(
      addStorageDaysField(`
        SELECT p.*, u.name as entered_by_name
        FROM packages p
        LEFT JOIN users u ON p.entered_by = u.id
        WHERE date(p.entered_at) = date('now','localtime')
        ORDER BY p.entered_at DESC
      `)
    ).all();
    res.json({ packages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/all', roleMiddleware('admin'), (req: Request, res: Response) => {
  try {
    autoExpirePackages();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const offset = (page - 1) * limit;

    let where = '';
    const params: any[] = [];
    if (status) {
      where = 'WHERE p.status = ?';
      params.push(status);
    }

    const countSql = `SELECT COUNT(*) as count FROM packages p ${where}`;
    const total = (db.prepare(countSql).get(...params) as any).count;

    const packages = db.prepare(
      addStorageDaysField(`
        SELECT p.*,
          u.name as entered_by_name,
          u2.name as picked_up_by_name,
          u3.name as processed_by_name
        FROM packages p
        LEFT JOIN users u ON p.entered_by = u.id
        LEFT JOIN users u2 ON p.picked_up_by = u2.id
        LEFT JOIN users u3 ON p.processed_by = u3.id
        ${where}
        ORDER BY p.entered_at DESC
        LIMIT ? OFFSET ?
      `)
    ).all(...params, limit, offset);

    res.json({ packages, total, page, limit });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/expired', roleMiddleware('admin'), (req: Request, res: Response) => {
  try {
    autoExpirePackages();
    const packages = db.prepare(
      addStorageDaysField(`
        SELECT p.*, u.name as entered_by_name
        FROM packages p
        LEFT JOIN users u ON p.entered_by = u.id
        WHERE p.status = 'expired'
        ORDER BY p.entered_at ASC
      `)
    ).all();
    res.json({ packages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/batch-return', roleMiddleware('admin'), (req: Request, res: Response) => {
  try {
    const { ids, note } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: '请选择要退回的包裹' });
      return;
    }

    const placeholders = ids.map(() => '?').join(',');
    const updateStmt = db.prepare(`
      UPDATE packages
      SET status = 'returned',
          processed_at = datetime('now','localtime'),
          processed_by = ?,
          process_note = ?
      WHERE id IN (${placeholders})
        AND status IN ('pending', 'expired')
    `);

    const result = updateStmt.run(req.user!.userId, note || '', ...ids);

    const updated = db.prepare(
      addStorageDaysField(`
        SELECT p.*, u.name as entered_by_name
        FROM packages p
        LEFT JOIN users u ON p.entered_by = u.id
        WHERE p.status = 'returned'
        ORDER BY p.processed_at DESC
        LIMIT ?
      `)
    ).all(ids.length);

    res.json({
      message: `成功退回 ${result.changes} 个包裹`,
      count: result.changes,
      packages: updated
    });
  } catch (err: any) {
    res.status(500).json({ error: '批量退回失败: ' + err.message });
  }
});

router.post('/batch-scrap', roleMiddleware('admin'), (req: Request, res: Response) => {
  try {
    const { ids, note } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: '请选择要报废的包裹' });
      return;
    }

    const placeholders = ids.map(() => '?').join(',');
    const updateStmt = db.prepare(`
      UPDATE packages
      SET status = 'scrapped',
          processed_at = datetime('now','localtime'),
          processed_by = ?,
          process_note = ?
      WHERE id IN (${placeholders})
        AND status IN ('pending', 'expired')
    `);

    const result = updateStmt.run(req.user!.userId, note || '', ...ids);

    const updated = db.prepare(
      addStorageDaysField(`
        SELECT p.*, u.name as entered_by_name
        FROM packages p
        LEFT JOIN users u ON p.entered_by = u.id
        WHERE p.status = 'scrapped'
        ORDER BY p.processed_at DESC
        LIMIT ?
      `)
    ).all(ids.length);

    res.json({
      message: `成功报废 ${result.changes} 个包裹`,
      count: result.changes,
      packages: updated
    });
  } catch (err: any) {
    res.status(500).json({ error: '批量报废失败: ' + err.message });
  }
});

export default router;
