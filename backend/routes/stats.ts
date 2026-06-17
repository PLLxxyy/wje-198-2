import { Router, Request, Response } from 'express';
import db from '../db.js';
import { roleMiddleware } from '../auth.js';

const router = Router();

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

router.get('/dashboard', roleMiddleware('admin'), (req: Request, res: Response) => {
  autoExpirePackages();
  try {
    const today = (db.prepare(
      `SELECT date('now','localtime') as d`
    ).get() as any).d;

    const totalToday = (db.prepare(
      `SELECT COUNT(*) as count FROM packages WHERE date(entered_at) = date('now','localtime')`
    ).get() as any).count;

    const pickedUpToday = (db.prepare(
      `SELECT COUNT(*) as count FROM packages WHERE date(picked_up_at) = date('now','localtime') AND status = 'picked_up'`
    ).get() as any).count;

    const pendingTotal = (db.prepare(
      `SELECT COUNT(*) as count FROM packages WHERE status = 'pending'`
    ).get() as any).count;

    const overdue = (db.prepare(
      `SELECT COUNT(*) as count FROM packages
       WHERE status = 'pending'
       AND julianday('now','localtime') - julianday(entered_at) > 3`
    ).get() as any).count;

    res.json({
      today,
      totalToday,
      pickedUpToday,
      pendingTotal,
      overdue
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/peak-hours', roleMiddleware('admin'), (req: Request, res: Response) => {
  try {
    const date = (req.query.date as string) || (db.prepare(
      `SELECT date('now','localtime') as d`
    ).get() as any).d;

    const hourly = db.prepare(
      `SELECT
        CAST(strftime('%H', picked_up_at) AS INTEGER) as hour,
        COUNT(*) as count
       FROM packages
       WHERE date(picked_up_at) = ?
         AND status = 'picked_up'
       GROUP BY strftime('%H', picked_up_at)
       ORDER BY hour`
    ).all(date);

    const hours: number[] = new Array(24).fill(0);
    (hourly as any[]).forEach((row: any) => {
      hours[row.hour] = row.count;
    });

    res.json({ date, hours });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/records', roleMiddleware('admin'), (req: Request, res: Response) => {
  try {
    autoExpirePackages();
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const offset = (page - 1) * limit;

    let where = "WHERE p.status = 'picked_up'";
    const params: any[] = [];

    if (status) {
      where = `WHERE p.status = ?`;
      params.push(status);
    }

    if (startDate) {
      const dateField = status === 'picked_up' ? 'p.picked_up_at' : 'p.entered_at';
      where += ` AND date(${dateField}) >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      const dateField = status === 'picked_up' ? 'p.picked_up_at' : 'p.entered_at';
      where += ` AND date(${dateField}) <= ?`;
      params.push(endDate);
    }

    const countSql = `SELECT COUNT(*) as count FROM packages p ${where}`;
    const total = (db.prepare(countSql).get(...params) as any).count;

    const orderField = status === 'picked_up' ? 'p.picked_up_at' : 'p.entered_at';
    const sql = addStorageDaysField(`
      SELECT p.*,
        u1.name as entered_by_name,
        u2.name as picked_up_by_name,
        u3.name as processed_by_name
      FROM packages p
      LEFT JOIN users u1 ON p.entered_by = u1.id
      LEFT JOIN users u2 ON p.picked_up_by = u2.id
      LEFT JOIN users u3 ON p.processed_by = u3.id
      ${where}
      ORDER BY ${orderField} DESC
      LIMIT ? OFFSET ?
    `);
    const records = db.prepare(sql).all(...params, limit, offset);

    res.json({ records, total, page, limit });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/overdue', roleMiddleware('admin'), (req: Request, res: Response) => {
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

export default router;
