import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const DB_PATH = path.join(dataDir, 'station.db');
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('courier','recipient','admin')),
    phone TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE TABLE packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_no TEXT UNIQUE NOT NULL,
    recipient_phone TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    pickup_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','picked_up','expired')),
    entered_by INTEGER NOT NULL,
    entered_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    picked_up_at TEXT,
    picked_up_by INTEGER,
    FOREIGN KEY (entered_by) REFERENCES users(id),
    FOREIGN KEY (picked_up_by) REFERENCES users(id)
  );
  CREATE INDEX idx_packages_recipient_phone ON packages(recipient_phone);
  CREATE INDEX idx_packages_status ON packages(status);
  CREATE INDEX idx_packages_tracking_no ON packages(tracking_no);
  CREATE INDEX idx_packages_entered_at ON packages(entered_at);
`);

console.log('数据库表已创建');

// --- 用户数据 ---
const hash = (pw: string) => bcrypt.hashSync(pw, 10);

const insertUser = db.prepare(
  'INSERT INTO users (username, password, name, role, phone) VALUES (?, ?, ?, ?, ?)'
);

const users = [
  ['admin',    hash('admin123'),    '系统管理员', 'admin',     '13800000000'],
  ['courier1', hash('courier123'),  '张快递',   'courier',   '13810001001'],
  ['courier2', hash('courier123'),  '李派送',   'courier',   '13810001002'],
  ['courier3', hash('courier123'),  '王小哥',   'courier',   '13810001003'],
  ['user1',    hash('user123'),     '赵小明',   'recipient', '13910002001'],
  ['user2',    hash('user123'),     '钱小红',   'recipient', '13910002002'],
  ['user3',    hash('user123'),     '孙小华',   'recipient', '13910002003'],
  ['user4',    hash('user123'),     '李小刚',   'recipient', '13910002004'],
  ['user5',    hash('user123'),     '周小芳',   'recipient', '13910002005'],
];

const userIds: Record<string, number> = {};
users.forEach(u => {
  const result = insertUser.run(...u);
  userIds[u[0]] = result.lastInsertRowid as number;
  console.log(`  用户 ${u[0]} (${u[2]}) 已创建`);
});

// --- 快递数据 ---
const insertPkg = db.prepare(
  `INSERT INTO packages (tracking_no, recipient_phone, recipient_name, pickup_code, status, entered_by, entered_at, picked_up_at, picked_up_by)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

interface PkgSeed {
  tracking_no: string;
  recipient_phone: string;
  recipient_name: string;
  pickup_code: string;
  status: 'pending' | 'picked_up';
  entered_by: string;
  entered_at: string;
  picked_up_at: string | null;
  picked_up_by: string | null;
}

const recipients = [
  { username: 'user1', phone: '13910002001', name: '赵小明' },
  { username: 'user2', phone: '13910002002', name: '钱小红' },
  { username: 'user3', phone: '13910002003', name: '孙小华' },
  { username: 'user4', phone: '13910002004', name: '李小刚' },
  { username: 'user5', phone: '13910002005', name: '周小芳' },
];

const couriers = ['courier1', 'courier2', 'courier3'];
const prefixes = ['SF', 'YT', 'ZT', 'STO', 'YD', 'JD', 'EMS'];
const code = () => String(Math.floor(100000 + Math.random() * 900000));

function makeTracking(i: number): string {
  const prefix = prefixes[i % prefixes.length];
  return `${prefix}${String(20260614000 + i).padStart(12, '0')}`;
}

function randomCourier(): string {
  return couriers[Math.floor(Math.random() * couriers.length)];
}

function randomRecipient() {
  return recipients[Math.floor(Math.random() * recipients.length)];
}

function daysAgo(days: number, hour: number, minute: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

const packages: PkgSeed[] = [];
let idx = 0;

// 5天前入库的快递 - 超时未取 (>3天) -> 6个
for (let i = 0; i < 6; i++) {
  const r = recipients[i % recipients.length];
  const enteredAt = daysAgo(5, 9 + (i % 8), i * 7);
  packages.push({
    tracking_no: makeTracking(idx++),
    recipient_phone: r.phone,
    recipient_name: r.name,
    pickup_code: code(),
    status: 'pending',
    entered_by: randomCourier(),
    entered_at: enteredAt,
    picked_up_at: null,
    picked_up_by: null,
  });
}

// 4天前入库的快递 - 超时未取 -> 3个
for (let i = 0; i < 3; i++) {
  const r = recipients[(i + 2) % recipients.length];
  packages.push({
    tracking_no: makeTracking(idx++),
    recipient_phone: r.phone,
    recipient_name: r.name,
    pickup_code: code(),
    status: 'pending',
    entered_by: randomCourier(),
    entered_at: daysAgo(4, 10 + i, 30),
    picked_up_at: null,
    picked_up_by: null,
  });
}

// 3天前入库 - 已取 -> 4个
for (let i = 0; i < 4; i++) {
  const r = recipients[i % recipients.length];
  packages.push({
    tracking_no: makeTracking(idx++),
    recipient_phone: r.phone,
    recipient_name: r.name,
    pickup_code: code(),
    status: 'picked_up',
    entered_by: randomCourier(),
    entered_at: daysAgo(3, 9 + i * 2, 15),
    picked_up_at: daysAgo(3, 14 + i, i * 10),
    picked_up_by: r.username,
  });
}

// 2天前入库 - 混合 -> 5个
for (let i = 0; i < 5; i++) {
  const r = recipients[i % recipients.length];
  const isPicked = i < 3;
  packages.push({
    tracking_no: makeTracking(idx++),
    recipient_phone: r.phone,
    recipient_name: r.name,
    pickup_code: code(),
    status: isPicked ? 'picked_up' : 'pending',
    entered_by: randomCourier(),
    entered_at: daysAgo(2, 8 + i * 2, 20),
    picked_up_at: isPicked ? daysAgo(1, 10 + i * 2, 30) : null,
    picked_up_by: isPicked ? r.username : null,
  });
}

// 1天前入库 - 混合 -> 6个
for (let i = 0; i < 6; i++) {
  const r = recipients[i % recipients.length];
  const isPicked = i < 4;
  packages.push({
    tracking_no: makeTracking(idx++),
    recipient_phone: r.phone,
    recipient_name: r.name,
    pickup_code: code(),
    status: isPicked ? 'picked_up' : 'pending',
    entered_by: randomCourier(),
    entered_at: daysAgo(1, 9 + i, i * 8),
    picked_up_at: isPicked ? daysAgo(1, 14 + (i % 4), i * 12) : null,
    picked_up_by: isPicked ? r.username : null,
  });
}

// 今天入库 - 混合, 用来显示高峰时段数据 -> 12个
const todayPickupHours = [9, 9, 10, 10, 10, 11, 11, 14, 14, 15, 17, 18];
for (let i = 0; i < 12; i++) {
  const r = recipients[i % recipients.length];
  const isPicked = i < 10;
  const pickupHour = todayPickupHours[i];
  packages.push({
    tracking_no: makeTracking(idx++),
    recipient_phone: r.phone,
    recipient_name: r.name,
    pickup_code: code(),
    status: isPicked ? 'picked_up' : 'pending',
    entered_by: randomCourier(),
    entered_at: daysAgo(0, Math.max(7, pickupHour - 2), i * 5),
    picked_up_at: isPicked ? daysAgo(0, pickupHour, i * 6) : null,
    picked_up_by: isPicked ? r.username : null,
  });
}

console.log(`\n正在插入 ${packages.length} 条快递数据...`);

packages.forEach(p => {
  insertPkg.run(
    p.tracking_no,
    p.recipient_phone,
    p.recipient_name,
    p.pickup_code,
    p.status,
    userIds[p.entered_by],
    p.entered_at,
    p.picked_up_at,
    p.picked_up_by ? userIds[p.picked_up_by] : null
  );
});

db.close();

console.log('\n========================================');
console.log('  种子数据初始化完成！');
console.log('========================================');
console.log('\n  测试账号:');
console.log('  管理员: admin / admin123');
console.log('  快递员: courier1 / courier123');
console.log('  用户:   user1 / user123');
console.log('\n  快递总数:', packages.length);
console.log('  已取件:', packages.filter(p => p.status === 'picked_up').length);
console.log('  待取件:', packages.filter(p => p.status === 'pending').length);
console.log('  超时(>3天):', packages.filter(p => p.status === 'pending' && (Date.now() - new Date(p.entered_at).getTime()) > 3 * 86400000).length);
console.log('');
