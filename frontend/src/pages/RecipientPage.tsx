import { useState, useEffect, FormEvent } from 'react';
import { api } from '../api';

interface Package {
  id: number;
  tracking_no: string;
  recipient_phone: string;
  recipient_name: string;
  pickup_code: string;
  status: string;
  entered_at: string;
  picked_up_at: string | null;
  entered_by_name?: string;
}

function daysSince(dateStr: string): number {
  const entered = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.floor((now - entered) / 86400000);
}

export default function RecipientPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackingNo, setTrackingNo] = useState('');
  const [pickupCode, setPickupCode] = useState('');
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    setLoading(true);
    try {
      const data = await api.getMyPackages();
      setPackages(data.packages);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePickup = async (e: FormEvent) => {
    e.preventDefault();
    setResult(null);
    if (!trackingNo.trim() || !pickupCode.trim()) {
      setResult({ type: 'error', message: '请输入快递单号和取件码' });
      return;
    }
    setSubmitting(true);
    try {
      const data = await api.pickup(trackingNo.trim(), pickupCode.trim());
      setResult({ type: 'success', message: data.message });
      setTrackingNo('');
      setPickupCode('');
      loadPackages();
    } catch (err: any) {
      setResult({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const pendingPackages = packages.filter(p => p.status === 'pending');
  const pickedPackages = packages.filter(p => p.status === 'picked_up');

  return (
    <>
      <h1 className="page-title">我的快递</h1>

      {/* Pickup form */}
      <div className="card mb-24">
        <div className="card-header">
          <div className="card-title">取件核销</div>
        </div>
        <div className="card-body">
          <form onSubmit={handlePickup}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">快递单号</label>
                <input
                  className="form-input"
                  placeholder="输入快递单号"
                  value={trackingNo}
                  onChange={e => setTrackingNo(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">取件码</label>
                <input
                  className="form-input form-input-lg"
                  placeholder="6位取件码"
                  value={pickupCode}
                  onChange={e => setPickupCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  style={{ letterSpacing: '6px' }}
                />
              </div>
            </div>
            <button className="btn btn-success btn-lg" style={{ width: '100%' }} disabled={submitting}>
              {submitting ? '核销中...' : '确认取件'}
            </button>
          </form>
          {result && (
            <div className={`alert ${result.type === 'success' ? 'alert-success' : 'alert-error'}`} style={{ marginTop: 16 }}>
              {result.message}
            </div>
          )}
        </div>
      </div>

      {/* Pending packages */}
      <div className="card mb-24">
        <div className="card-header">
          <div className="card-title">待取件 ({pendingPackages.length})</div>
          <button className="btn btn-secondary btn-sm" onClick={loadPackages}>刷新</button>
        </div>
        {loading ? (
          <div className="loading"><div className="spinner" /><span>加载中...</span></div>
        ) : pendingPackages.length === 0 ? (
          <div className="empty-state">
            <p>暂无待取件快递</p>
            <p className="sub">新快递入库后会显示在这里</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>快递单号</th>
                  <th>取件码</th>
                  <th>入库时间</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {pendingPackages.map(p => {
                  const days = daysSince(p.entered_at);
                  const isOverdue = days > 3;
                  return (
                    <tr key={p.id} className={isOverdue ? 'overdue-row' : ''}>
                      <td>
                        <span className="tracking-no">{p.tracking_no}</span>
                        <button
                          className="btn btn-sm btn-secondary"
                          style={{ marginLeft: 8 }}
                          onClick={() => { setTrackingNo(p.tracking_no); setPickupCode(''); }}
                        >
                          填入
                        </button>
                      </td>
                      <td><span className="code-highlight" style={{ fontSize: 18 }}>{p.pickup_code}</span></td>
                      <td className="text-sm text-gray">{p.entered_at}</td>
                      <td>
                        {isOverdue
                          ? <span className="badge badge-overdue">超时 {days} 天</span>
                          : <span className="badge badge-pending">待取件</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Picked packages */}
      {pickedPackages.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">已取件 ({pickedPackages.length})</div>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>快递单号</th>
                  <th>入库时间</th>
                  <th>取件时间</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {pickedPackages.map(p => (
                  <tr key={p.id}>
                    <td><span className="tracking-no">{p.tracking_no}</span></td>
                    <td className="text-sm text-gray">{p.entered_at}</td>
                    <td className="text-sm text-gray">{p.picked_up_at}</td>
                    <td><span className="badge badge-picked">已取件</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
