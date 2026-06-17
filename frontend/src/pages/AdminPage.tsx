import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

interface Dashboard {
  today: string;
  totalToday: number;
  pickedUpToday: number;
  pendingTotal: number;
  overdue: number;
}

interface PickupRecord {
  id: number;
  tracking_no: string;
  recipient_name: string;
  recipient_phone: string;
  pickup_code: string;
  status: string;
  entered_at: string;
  picked_up_at: string | null;
  processed_at: string | null;
  process_note: string | null;
  entered_by_name: string | null;
  picked_up_by_name: string | null;
  processed_by_name: string | null;
  storage_days: number;
}

type TabKey = 'all' | 'pending' | 'picked_up' | 'expired' | 'returned' | 'scrapped';

const statusLabels: Record<string, string> = {
  pending: '待取件',
  picked_up: '已取件',
  expired: '已过期',
  returned: '已退回',
  scrapped: '已报废',
};

const statusColors: Record<string, string> = {
  pending: 'status-pending',
  picked_up: 'status-picked',
  expired: 'status-expired',
  returned: 'status-returned',
  scrapped: 'status-scrapped',
};

function todayStr(): string {
  const d = new Date();
  return d.toISOString().substring(0, 10);
}

export default function AdminPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [hours, setHours] = useState<number[]>(new Array(24).fill(0));
  const [chartDate, setChartDate] = useState(todayStr());
  const [records, setRecords] = useState<PickupRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [processNote, setProcessNote] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [batchAction, setBatchAction] = useState<'return' | 'scrap' | null>(null);
  const limit = 15;

  const loadDashboard = useCallback(async () => {
    try {
      const data = await api.getDashboard();
      setDashboard(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadPeakHours = useCallback(async (date?: string) => {
    try {
      const data = await api.getPeakHours(date);
      setHours(data.hours);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadRecords = useCallback(async () => {
    try {
      const status = activeTab === 'all' ? '' : activeTab;
      const data = await api.getRecords({
        start_date: startDate,
        end_date: endDate,
        page,
        limit,
        status,
      });
      setRecords(data.records);
      setTotalRecords(data.total);
    } catch (err) {
      console.error(err);
    }
  }, [startDate, endDate, page, activeTab]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadDashboard(), loadPeakHours(chartDate), loadRecords()]);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    loadPeakHours(chartDate);
  }, [chartDate, loadPeakHours]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [activeTab, startDate, endDate]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const maxHour = Math.max(...hours, 1);
  const totalPages = Math.ceil(totalRecords / limit);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === records.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map(r => r.id)));
    }
  };

  const openBatchModal = (action: 'return' | 'scrap') => {
    if (selectedIds.size === 0) {
      alert('请先选择要处理的包裹');
      return;
    }
    setBatchAction(action);
    setProcessNote('');
    setShowNoteModal(true);
  };

  const handleBatchAction = async () => {
    if (!batchAction || selectedIds.size === 0) return;

    try {
      if (batchAction === 'return') {
        await api.batchReturn(Array.from(selectedIds), processNote);
        alert(`成功退回 ${selectedIds.size} 个包裹`);
      } else {
        await api.batchScrap(Array.from(selectedIds), processNote);
        alert(`成功报废 ${selectedIds.size} 个包裹`);
      }
      setShowNoteModal(false);
      setSelectedIds(new Set());
      setBatchAction(null);
      loadRecords();
      loadDashboard();
    } catch (err: any) {
      alert(err.message || '操作失败');
    }
  };

  const isBatchDisabled = selectedIds.size === 0 ||
    !['pending', 'expired', 'all'].includes(activeTab);

  if (loading) {
    return <div className="loading"><div className="spinner" /><span>加载中...</span></div>;
  }

  return (
    <>
      <h1 className="page-title">管理员后台</h1>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card orange">
          <div className="stat-label">今日入库</div>
          <div className="stat-value">{dashboard?.totalToday ?? 0}</div>
          <div className="stat-icon">{'\u{1F4E6}'}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">今日取件</div>
          <div className="stat-value">{dashboard?.pickedUpToday ?? 0}</div>
          <div className="stat-icon">{'\u{2705}'}</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">待取件总数</div>
          <div className="stat-value">{dashboard?.pendingTotal ?? 0}</div>
          <div className="stat-icon">{'\u{1F4E5}'}</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">超时未取(&gt;3天)</div>
          <div className="stat-value">{dashboard?.overdue ?? 0}</div>
          <div className="stat-icon">{'\u{26A0}'}</div>
        </div>
      </div>

      {/* Peak Hours Chart */}
      <div className="chart-container mb-24">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="chart-title" style={{ marginBottom: 0 }}>每日取件高峰时段</div>
          <div className="flex-row">
            <label className="text-sm text-gray">选择日期:</label>
            <input
              type="date"
              className="date-picker"
              value={chartDate}
              onChange={e => setChartDate(e.target.value)}
            />
          </div>
        </div>
        <div className="bar-chart">
          {hours.map((count, hour) => (
            <div className="bar-col" key={hour}>
              <div className="bar-value">{count > 0 ? count : ''}</div>
              <div
                className={`bar ${count > 0 ? 'active' : 'inactive'}`}
                style={{ height: `${count > 0 ? Math.max((count / maxHour) * 160, 4) : 2}px` }}
              />
              <div className="bar-label">{hour}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 28, fontSize: 13, color: 'var(--gray-400)' }}>
          时间（小时） / 取件数量
        </div>
      </div>

      {/* Records Table with Tabs */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">包裹管理</div>
          <div className="flex-row">
            <span className="text-sm text-gray">共 {totalRecords} 条</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => handleTabChange('all')}
          >
            全部
          </button>
          <button
            className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => handleTabChange('pending')}
          >
            待取件
          </button>
          <button
            className={`tab-btn ${activeTab === 'expired' ? 'active' : ''}`}
            onClick={() => handleTabChange('expired')}
          >
            已过期
          </button>
          <button
            className={`tab-btn ${activeTab === 'picked_up' ? 'active' : ''}`}
            onClick={() => handleTabChange('picked_up')}
          >
            已取件
          </button>
          <button
            className={`tab-btn ${activeTab === 'returned' ? 'active' : ''}`}
            onClick={() => handleTabChange('returned')}
          >
            已退回
          </button>
          <button
            className={`tab-btn ${activeTab === 'scrapped' ? 'active' : ''}`}
            onClick={() => handleTabChange('scrapped')}
          >
            已报废
          </button>
        </div>

        {/* Batch Actions & Filters */}
        <div className="card-body" style={{ padding: '12px 20px 0' }}>
          <div className="filter-bar">
            <label className="text-sm text-gray">开始日期:</label>
            <input type="date" className="date-picker" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }} />
            <label className="text-sm text-gray">结束日期:</label>
            <input type="date" className="date-picker" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }} />
            <button className="btn btn-secondary btn-sm" onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}>
              重置
            </button>
          </div>

          {(activeTab === 'all' || activeTab === 'pending' || activeTab === 'expired') && (
            <div className="batch-bar">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={records.length > 0 && selectedIds.size === records.length}
                  onChange={toggleSelectAll}
                />
                <span>全选</span>
              </label>
              <span className="text-sm text-gray">已选 {selectedIds.size} 项</span>
              <button
                className="btn btn-warning btn-sm"
                disabled={isBatchDisabled}
                onClick={() => openBatchModal('return')}
              >
                批量退回
              </button>
              <button
                className="btn btn-danger btn-sm"
                disabled={isBatchDisabled}
                onClick={() => openBatchModal('scrap')}
              >
                批量报废
              </button>
            </div>
          )}
        </div>

        {records.length === 0 ? (
          <div className="empty-state">
            <p>暂无包裹记录</p>
            <p className="sub">调整筛选条件或等待新包裹入库</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  {(activeTab === 'all' || activeTab === 'pending' || activeTab === 'expired') && (
                    <th style={{ width: 40 }}>
                      <input
                        type="checkbox"
                        checked={records.length > 0 && selectedIds.size === records.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                  )}
                  <th>快递单号</th>
                  <th>收件人</th>
                  <th>手机号</th>
                  <th>状态</th>
                  <th>存放天数</th>
                  <th>入库操作员</th>
                  <th>入库时间</th>
                  <th>处理时间</th>
                  <th>处理人</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} className={selectedIds.has(r.id) ? 'selected' : ''}>
                    {(activeTab === 'all' || activeTab === 'pending' || activeTab === 'expired') && (
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.id)}
                          onChange={() => toggleSelect(r.id)}
                          disabled={r.status === 'picked_up' || r.status === 'returned' || r.status === 'scrapped'}
                        />
                      </td>
                    )}
                    <td><span className="tracking-no">{r.tracking_no}</span></td>
                    <td>{r.recipient_name}</td>
                    <td>{r.recipient_phone}</td>
                    <td>
                      <span className={`status-tag ${statusColors[r.status]}`}>
                        {statusLabels[r.status] || r.status}
                      </span>
                    </td>
                    <td>
                      <span className={`storage-days ${r.storage_days > 3 ? 'overdue' : ''}`}>
                        {r.storage_days} 天
                      </span>
                    </td>
                    <td>{r.entered_by_name || '-'}</td>
                    <td className="text-sm text-gray">{r.entered_at}</td>
                    <td className="text-sm text-gray">{r.picked_up_at || r.processed_at || '-'}</td>
                    <td className="text-sm text-gray">{r.picked_up_by_name || r.processed_by_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              上一页
            </button>
            <span className="page-info">第 {page} / {totalPages} 页</span>
            <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              下一页
            </button>
          </div>
        )}
      </div>

      {/* Batch Action Modal */}
      {showNoteModal && (
        <div className="modal-overlay" onClick={() => setShowNoteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{batchAction === 'return' ? '批量退回' : '批量报废'}</h3>
              <button className="modal-close" onClick={() => setShowNoteModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p>确定要{batchAction === 'return' ? '退回' : '报废'}选中的 {selectedIds.size} 个包裹吗？</p>
              <div className="form-group">
                <label>处理备注（可选）:</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={processNote}
                  onChange={e => setProcessNote(e.target.value)}
                  placeholder="请输入处理备注..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNoteModal(false)}>取消</button>
              <button
                className={batchAction === 'return' ? 'btn btn-warning' : 'btn btn-danger'}
                onClick={handleBatchAction}
              >
                确认{batchAction === 'return' ? '退回' : '报废'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
