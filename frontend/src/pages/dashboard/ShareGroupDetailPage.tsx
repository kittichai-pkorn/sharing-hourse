import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/client';

interface Member {
  id: number;
  memberCode: string;
  nickname: string;
  address: string | null;
  phone: string | null;
  lineId: string | null;
  hasWon: boolean;
  wonRoundNumber: number | null;
  user?: {
    firstName: string;
    lastName: string;
  };
}

interface ShareGroup {
  id: number;
  name: string;
  type: string;
  maxMembers: number;
  principalAmount: number;
  status: string;
  startDate: string;
  members: Member[];
  summary: {
    wonCount: number;
    notWonCount: number;
    totalMembers: number;
    maxMembers: number;
  };
}

const typeLabels: Record<string, string> = {
  STEP_INTEREST: 'ขั้นบันได',
  BID_INTEREST: 'บิทดอกตาม',
  FIXED_INTEREST: 'ดอกตาม',
  BID_PRINCIPAL: 'บิทลดต้น (หักดอกท้าย)',
  BID_PRINCIPAL_FIRST: 'บิทลดต้น (หักดอกหน้า)',
};

export default function ShareGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<ShareGroup | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({
    nickname: '',
    address: '',
    phone: '',
    lineId: '',
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const fetchGroup = async () => {
    try {
      const response = await api.get(`/share-groups/${id}`);
      setGroup(response.data.data);
    } catch (err) {
      console.error('Failed to fetch group:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGroup();
  }, [id]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await api.post(`/members/group/${id}`, formData);
      setMessage('เพิ่มสมาชิกเรียบร้อยแล้ว');
      setShowAddModal(false);
      resetForm();
      fetchGroup();
    } catch (err: any) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาด');
    }
  };

  const handleEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await api.put(`/members/${editingMember?.id}`, formData);
      setMessage('แก้ไขข้อมูลเรียบร้อยแล้ว');
      setShowEditModal(false);
      setEditingMember(null);
      resetForm();
      fetchGroup();
    } catch (err: any) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาด');
    }
  };

  const handleDeleteMember = async (memberId: number) => {
    if (!confirm('ต้องการลบสมาชิกนี้?')) return;

    try {
      await api.delete(`/members/${memberId}`);
      setMessage('ลบสมาชิกเรียบร้อยแล้ว');
      fetchGroup();
    } catch (err: any) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาด');
    }
  };

  const openEditModal = (member: Member) => {
    setEditingMember(member);
    setFormData({
      nickname: member.nickname,
      address: member.address || '',
      phone: member.phone || '',
      lineId: member.lineId || '',
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      nickname: '',
      address: '',
      phone: '',
      lineId: '',
    });
  };

  if (isLoading) {
    return <div className="text-center py-8">กำลังโหลด...</div>;
  }

  if (!group) {
    return <div className="text-center py-8">ไม่พบวงแชร์</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <Link to="/share-groups" className="text-blue-600 hover:text-blue-500 text-sm">
          &larr; กลับไปรายการวงแชร์
        </Link>
      </div>

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded mb-6">
          {message}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Group Info */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{group.name}</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">ประเภท:</span>
            <p className="font-medium">{typeLabels[group.type]}</p>
          </div>
          <div>
            <span className="text-gray-500">เงินต้น:</span>
            <p className="font-medium">{group.principalAmount.toLocaleString()} บาท</p>
          </div>
          <div>
            <span className="text-gray-500">สมาชิก:</span>
            <p className="font-medium">{group.members.length}/{group.maxMembers} คน</p>
          </div>
          <div>
            <span className="text-gray-500">เงินกองกลาง:</span>
            <p className="font-medium">{(group.principalAmount * group.maxMembers).toLocaleString()} บาท</p>
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <div>
            <h2 className="text-lg font-medium">สมาชิก ({group.members.length}/{group.maxMembers})</h2>
            {group.summary && (
              <div className="flex gap-4 mt-1 text-sm">
                <span className="text-green-600">เปียแล้ว: {group.summary.wonCount}</span>
                <span className="text-blue-600">ยังไม่เปีย: {group.summary.notWonCount}</span>
              </div>
            )}
          </div>
          {group.status === 'DRAFT' && group.members.length < group.maxMembers && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              + เพิ่มสมาชิก
            </button>
          )}
        </div>

        {group.members.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            ยังไม่มีสมาชิก
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">รหัส</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ชื่อเล่น</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">เบอร์โทร</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">จัดการ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {group.members.map((member) => (
                <tr key={member.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {member.memberCode}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {member.nickname}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {member.hasWon ? (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                        เปียแล้ว (งวด {member.wonRoundNumber})
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        ยังไม่เปีย
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {member.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={() => openEditModal(member)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      แก้ไข
                    </button>
                    {group.status === 'DRAFT' && !member.hasWon && (
                      <button
                        onClick={() => handleDeleteMember(member.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        ลบ
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">เพิ่มสมาชิก</h2>
              <button onClick={() => { setShowAddModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">
                &#x2715;
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded text-sm">
                  {error}
                </div>
              )}

              <div className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded">
                รหัสลูกแชร์จะถูกสร้างอัตโนมัติ (A, B, C, ...)
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">ชื่อเล่น *</label>
                <input
                  type="text"
                  required
                  value={formData.nickname}
                  onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">เบอร์โทร</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0891234567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">ไลน์ไอดี</label>
                <input
                  type="text"
                  value={formData.lineId}
                  onChange={(e) => setFormData({ ...formData, lineId: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">ที่อยู่</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  เพิ่ม
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {showEditModal && editingMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">แก้ไขสมาชิก</h2>
              <button onClick={() => { setShowEditModal(false); setEditingMember(null); resetForm(); }} className="text-gray-400 hover:text-gray-600">
                &#x2715;
              </button>
            </div>

            <form onSubmit={handleEditMember} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">รหัสลูกแชร์</label>
                <div className="mt-1 px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-gray-700 font-medium">
                  {editingMember?.memberCode}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">ชื่อเล่น *</label>
                <input
                  type="text"
                  required
                  value={formData.nickname}
                  onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">เบอร์โทร</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">ไลน์ไอดี</label>
                <input
                  type="text"
                  value={formData.lineId}
                  onChange={(e) => setFormData({ ...formData, lineId: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">ที่อยู่</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingMember(null); resetForm(); }}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
