import { useAuthStore } from '../../stores/authStore';

export default function DashboardPage() {
  const { user, tenant } = useAuthStore();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">ข้อมูลวง</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">ชื่อวง</dt>
            <dd className="mt-1 text-sm text-gray-900">{tenant?.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">รหัสวง</dt>
            <dd className="mt-1 text-sm text-gray-900">{tenant?.slug}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">ข้อมูลผู้ใช้</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">ชื่อ-นามสกุล</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {user?.firstName} {user?.lastName}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">บทบาท</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {user?.role === 'ADMIN' ? 'ท้าวแชร์ (Admin)' : 'ลูกแชร์ (User)'}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
