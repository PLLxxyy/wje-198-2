# 快递驿站管理系统

一站式快递驿站管理平台，支持快递入库、取件核销、数据统计。

## 技术栈

- **前端**: Vite + React 18 + TypeScript (端口 5198)
- **后端**: Express + TypeScript + better-sqlite3 (端口 3298)
- **认证**: JWT + bcryptjs
- **并发启动**: concurrently

## 快速启动

```bash
npm run install:all && npm run seed && npm run dev
```

启动后访问 http://localhost:5198

## 测试账号

| 角色   | 用户名    | 密码         |
| ------ | --------- | ------------ |
| 管理员 | admin     | admin123     |
| 快递员 | courier1  | courier123   |
| 收件人 | user1     | user123      |

更多快递员: courier2/courier3 (密码 courier123)
更多收件人: user2-user5 (密码 user123)

## 功能说明

### 快递员
- 扫码/输入快递单号入库
- 填写收件人手机号和姓名
- 系统自动生成6位取件码
- 查看今日入库记录

### 收件人
- 查看待取件列表
- 超时3天快递高亮提醒
- 输入取件码核销取件
- 查看历史取件记录

### 管理员
- 查看今日入库/取件/超时数据概览
- 每日取件高峰时段统计图
- 按日期筛选取件记录
- 分页浏览全部记录

## 项目结构

```
wje-198/
├── package.json          # 根配置，npm run dev 并发启动
├── README.md
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── server.ts         # Express 入口
│   ├── db.ts             # 数据库初始化
│   ├── auth.ts           # JWT 认证中间件
│   ├── seed.ts           # 种子数据
│   └── routes/
│       ├── auth.ts       # 登录注册
│       ├── packages.ts   # 快递管理
│       └── stats.ts      # 数据统计
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html         # 含所有样式
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api.ts
        ├── contexts/
        │   └── AuthContext.tsx
        ├── components/
        │   └── Layout.tsx
        └── pages/
            ├── LoginPage.tsx
            ├── CourierPage.tsx
            ├── RecipientPage.tsx
            └── AdminPage.tsx
```

## API 接口

### 认证
- `POST /api/auth/login` - 登录
- `POST /api/auth/register` - 注册
- `GET /api/auth/me` - 获取当前用户

### 快递管理
- `POST /api/packages` - 入库 (快递员)
- `GET /api/packages/search?tracking_no=` - 查询 (快递员)
- `GET /api/packages/my` - 我的快递 (收件人)
- `POST /api/packages/pickup` - 取件核销 (收件人)
- `GET /api/packages/today` - 今日入库 (快递员)
- `GET /api/packages/all` - 全部快递 (管理员)

### 数据统计
- `GET /api/stats/dashboard` - 仪表盘数据
- `GET /api/stats/peak-hours?date=` - 高峰时段
- `GET /api/stats/records?start_date=&end_date=&page=&limit=` - 取件记录
- `GET /api/stats/overdue` - 超时快递
