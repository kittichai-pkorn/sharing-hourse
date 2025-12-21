import { useState, useEffect } from 'react';
import { superadminApi } from '../../api/client';
import { useSuperAdminStore } from '../../stores/superadminStore';

interface Stats {
  tenants: {
    total: number;
    active: number;
    pending: number;
  };
  users: {
    total: number;
  };
  shareGroups: {
    total: number;
  };
}

interface Tenant {
  id: number;
  name: string;
  slug: string;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  createdAt: string;
  _count: {
    users: number;
    shareGroups: number;
  };
}

export default function SuperAdminDashboard() {
  const { logout } = useSuperAdminStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const fetchData = async () => {
    try {
      const [statsRes, tenantsRes] = await Promise.all([
        superadminApi.get('/stats'),
        superadminApi.get('/tenants'),
      ]);
      setStats(statsRes.data.data);
      setTenants(tenantsRes.data.data);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await superadminApi.put(`/tenants/${id}/status`, { status });
      fetchData();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      ACTIVE: 'bg-green-100 text-green-800',
      SUSPENDED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    };
    const labels: Record<string, string> = {
      PENDING: 'รออนุมัติ',
      ACTIVE: 'ใช้งาน',
      SUSPENDED: 'ระงับ',
      CANCELLED: 'ยกเลิก',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        กำลังโหลด...
      </div>
    );
  }

  const filteredTenants = tenants.filter(
    (t) =>
      (!filter || t.status === filter) &&
      t.name.toLowerCase().includes('')
  );

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-white">Super Admin Panel</h1>
          <button
            onClick={logout}
            className="text-gray-400 hover:text-white text-sm"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="text-gray-400 text-sm">Tenants ทั้งหมด</div>
            <div className="text-3xl font-bold text-white mt-2">{stats?.tenants.total}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="text-gray-400 text-sm">ใช้งานอยู่</div>
            <div className="text-3xl font-bold text-green-400 mt-2">{stats?.tenants.active}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="text-gray-400 text-sm">รออนุมัติ</div>
            <div className="text-3xl font-bold text-yellow-400 mt-2">{stats?.tenants.pending}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="text-gray-400 text-sm">Users ทั้งหมด</div>
            <div className="text-3xl font-bold text-white mt-2">{stats?.users.total}</div>
          </div>
        </div>

        {/* Tenants Table */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center">
            <h2 className="text-lg font-medium text-white">Tenants</h2>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-white text-sm rounded px-3 py-1"
            >
              <option value="">ทั้งหมด</option>
              <option value="PENDING">รออนุมัติ</option>
              <option value="ACTIVE">ใช้งาน</option>
              <option value="SUSPENDED">ระงับ</option>
            </select>
          </div>

          <table className="min-w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  ชื่อวง
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  รหัส
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  สถานะ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  สมาชิก
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  วงแชร์
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredTenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td className="px-6 py-4 text-sm text-white">{tenant.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{tenant.slug}</td>
                  <td className="px-6 py-4">{getStatusBadge(tenant.status)}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{tenant._count.users}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{tenant._count.shareGroups}</td>
                  <td className="px-6 py-4 text-right">
                    {tenant.status === 'PENDING' && (
                      <button
                        onClick={() => handleUpdateStatus(tenant.id, 'ACTIVE')}
                        className="text-green-400 hover:text-green-300 text-sm mr-3"
                      >
                        อนุมัติ
                      </button>
                    )}
                    {tenant.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleUpdateStatus(tenant.id, 'SUSPENDED')}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        ระงับ
                      </button>
                    )}
                    {tenant.status === 'SUSPENDED' && (
                      <button
                        onClick={() => handleUpdateStatus(tenant.id, 'ACTIVE')}
                        className="text-green-400 hover:text-green-300 text-sm"
                      >
                        เปิดใช้งาน
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
