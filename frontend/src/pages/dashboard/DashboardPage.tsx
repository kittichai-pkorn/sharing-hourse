import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import api from '../../api/client';

interface DashboardSummary {
  totalGroups: number;
  inProgressGroups: number;
  pendingRounds: number;
  waitingCollection: number;
}

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
  DRAFT: { label: 'ร่าง', color: 'bg-gray-100 text-gray-800', icon: '📝' },
  OPEN: { label: 'เปิดรับสมาชิก', color: 'bg-blue-100 text-blue-800', icon: '📢' },
  IN_PROGRESS: { label: 'กำลังดำเนินการ', color: 'bg-green-100 text-green-800', icon: '🟢' },
  COMPLETED: { label: 'เสร็จสิ้น', color: 'bg-purple-100 text-purple-800', icon: '✅' },
  CANCELLED: { label: 'ยกเลิก', color: 'bg-red-100 text-red-800', icon: '❌' },
};

export default function DashboardPage() {
  const { tenant } = useAuthStore();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentGroups, setRecentGroups] = useState<ShareGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryRes, groupsRes] = await Promise.all([
          api.get('/dashboard/summary'),
          api.get('/share-groups'),
        ]);
        setSummary(summaryRes.data.data);
        setRecentGroups(groupsRes.data.data.slice(0, 6)); // Show only 6 recent groups
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return <div className="text-center py-8">กำลังโหลด...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">{tenant?.name}</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">วงทั้งหมด</p>
              <p className="text-2xl font-bold text-gray-900">{summary?.totalGroups || 0}</p>
            </div>
            <div className="text-3xl">📊</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">กำลังดำเนินการ</p>
              <p className="text-2xl font-bold text-green-600">{summary?.inProgressGroups || 0}</p>
            </div>
            <div className="text-3xl">🟢</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">รอดำเนินการ</p>
              <p className="text-2xl font-bold text-yellow-600">{summary?.pendingRounds || 0}</p>
            </div>
            <div className="text-3xl">⏳</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">รอเก็บเงิน</p>
              <p className="text-2xl font-bold text-orange-600">{summary?.waitingCollection || 0}</p>
            </div>
            <div className="text-3xl">💰</div>
          </div>
        </div>
      </div>

      {/* Recent Groups */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">วงแชร์ล่าสุด</h2>
          <Link to="/share-groups" className="text-sm text-blue-600 hover:text-blue-500">
            ดูทั้งหมด →
          </Link>
        </div>

        {recentGroups.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <p className="text-gray-500 mb-4">ยังไม่มีวงแชร์</p>
            <Link to="/share-groups" className="text-blue-600 hover:text-blue-500">
              สร้างวงแชร์แรก
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentGroups.map((group) => (
              <Link
                key={group.id}
                to={`/share-groups/${group.id}`}
                className="bg-white shadow rounded-lg p-5 hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-medium text-gray-900 line-clamp-1">{group.name}</h3>
                  <span className={`px-2 py-1 rounded text-xs whitespace-nowrap ${statusConfig[group.status]?.color}`}>
                    {statusConfig[group.status]?.icon} {statusConfig[group.status]?.label}
                  </span>
                </div>

                {/* Type */}
                <p className="text-sm text-gray-500 mb-3">{typeLabels[group.type]}</p>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                  <div>
                    <span className="text-gray-500">สมาชิก:</span>{' '}
                    <span className="font-medium">{group._count.members}/{group.maxMembers}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">เงินต้น:</span>{' '}
                    <span className="font-medium">{group.principalAmount.toLocaleString()}</span>
                  </div>
                </div>

                {/* Progress */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>งวดปัจจุบัน: {group.progress.current}/{group.progress.total}</span>
                    <span>{group.progress.percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${group.progress.percentage}%` }}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
