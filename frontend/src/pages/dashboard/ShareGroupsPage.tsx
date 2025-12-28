import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';

interface ShareGroup {
  id: number;
  name: string;
  type: string;
  maxMembers: number;
  principalAmount: number;
  status: string;
  startDate: string;
  host: {
    firstName: string;
    lastName: string;
  };
  _count: {
    members: number;
    rounds: number;
  };
  progress: {
    current: number;
    total: number;
    completed: number;
    percentage: number;
  };
}

const typeLabels: Record<string, string> = {
  STEP_INTEREST: 'ขั้นบันได',
  BID_INTEREST: 'บิทดอกตาม',
  FIXED_INTEREST: 'ดอกตาม',
  BID_PRINCIPAL: 'บิทลดต้น (หักดอกท้าย)',
  BID_PRINCIPAL_FIRST: 'บิทลดต้น (หักดอกหน้า)',
};

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  DRAFT: { label: 'ร่าง', color: 'bg-gray-700 text-gray-300', icon: '📝' },
  OPEN: { label: 'เปิดรับสมาชิก', color: 'bg-blue-900/50 text-blue-400', icon: '📢' },
  IN_PROGRESS: { label: 'กำลังดำเนินการ', color: 'bg-green-900/50 text-green-400', icon: '🟢' },
  COMPLETED: { label: 'เสร็จสิ้น', color: 'bg-purple-900/50 text-purple-400', icon: '✅' },
  CANCELLED: { label: 'ยกเลิก', color: 'bg-red-900/50 text-red-400', icon: '❌' },
};

export default function ShareGroupsPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<ShareGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search and Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const fetchGroups = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);

      const queryString = params.toString();
      const url = queryString ? `/share-groups?${queryString}` : '/share-groups';

      const response = await api.get(url);
      setGroups(response.data.data);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, typeFilter]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchGroups();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchGroups]);

  if (isLoading) {
    return <div className="text-center py-8 text-gray-400">กำลังโหลด...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-100">วงแชร์</h1>
        <button
          onClick={() => navigate('/share-groups/new')}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + สร้างวงแชร์
        </button>
      </div>

      {/* Search and Filter */}
      <div className="bg-gray-800 shadow-lg rounded-lg p-4 border border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                🔍
              </span>
              <input
                type="text"
                placeholder="ค้นหาชื่อวง..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">สถานะ: ทั้งหมด</option>
              <option value="DRAFT">ร่าง</option>
              <option value="OPEN">เปิดรับสมาชิก</option>
              <option value="IN_PROGRESS">กำลังดำเนินการ</option>
              <option value="COMPLETED">เสร็จสิ้น</option>
              <option value="CANCELLED">ยกเลิก</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">ประเภท: ทั้งหมด</option>
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Groups List */}
      {groups.length === 0 ? (
        <div className="bg-gray-800 shadow-lg rounded-lg p-8 text-center border border-gray-700">
          <p className="text-gray-400 mb-4">
            {search || statusFilter !== 'all' || typeFilter !== 'all'
              ? 'ไม่พบวงแชร์ที่ค้นหา'
              : 'ยังไม่มีวงแชร์'}
          </p>
          {!search && statusFilter === 'all' && typeFilter === 'all' && (
            <button
              onClick={() => navigate('/share-groups/new')}
              className="text-blue-400 hover:text-blue-300"
            >
              สร้างวงแชร์แรก
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Link
              key={group.id}
              to={`/share-groups/${group.id}`}
              className="bg-gray-800 shadow-lg rounded-lg p-5 hover:bg-gray-750 transition-colors border border-gray-700"
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-medium text-gray-100 line-clamp-1">{group.name}</h3>
                <span className={`px-2 py-1 rounded text-xs whitespace-nowrap ${statusConfig[group.status]?.color}`}>
                  {statusConfig[group.status]?.icon} {statusConfig[group.status]?.label}
                </span>
              </div>

              {/* Type */}
              <p className="text-sm text-gray-400 mb-3">{typeLabels[group.type]}</p>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                <div>
                  <span className="text-gray-400">สมาชิก:</span>{' '}
                  <span className="font-medium text-gray-100">{group._count.members}/{group.maxMembers}</span>
                </div>
                <div>
                  <span className="text-gray-400">เงินต้น:</span>{' '}
                  <span className="font-medium text-gray-100">{group.principalAmount.toLocaleString()}</span>
                </div>
              </div>

              {/* Progress */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>งวดปัจจุบัน: {group.progress.current}/{group.progress.total}</span>
                  <span>{group.progress.percentage}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${group.progress.percentage}%` }}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
