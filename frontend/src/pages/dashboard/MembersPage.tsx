import { useState, useEffect } from 'react';
import api from '../../api/client';

interface Member {
  id: number;
  memberCode: string;
  nickname: string;
  address: string | null;
  phone: string | null;
  lineId: string | null;
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
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

  const fetchMembers = async () => {
    try {
      const response = await api.get('/members');
      setMembers(response.data.data);
    } catch (err) {
      console.error('Failed to fetch members:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await api.post('/members', formData);
      setMessage('เพิ่มลูกแชร์เรียบร้อยแล้ว');
      setShowAddModal(false);
      resetForm();
      fetchMembers();
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
      fetchMembers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาด');
    }
  };

  const handleDeleteMember = async (memberId: number) => {
    if (!confirm('ต้องการลบลูกแชร์นี้?')) return;

    try {
      await api.delete(`/members/${memberId}`);
      setMessage('ลบลูกแชร์เรียบร้อยแล้ว');
      fetchMembers();
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

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ลูกแชร์</h1>
          <p className="text-gray-500 text-sm mt-1">จัดการรายชื่อลูกแชร์ในระบบ</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + เพิ่มลูกแชร์
        </button>
      </div>

      {/* Messages */}
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

      {/* Members Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {members.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            ยังไม่มีลูกแชร์
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">รหัส</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ชื่อเล่น</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">เบอร์โทร</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ไลน์</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">จัดการ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded">
                      {member.memberCode}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {member.nickname}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {member.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {member.lineId || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={() => openEditModal(member)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => handleDeleteMember(member.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      ลบ
                    </button>
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
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">เพิ่มลูกแชร์</h2>
              <button onClick={() => { setShowAddModal(false); resetForm(); setError(''); }} className="text-gray-400 hover:text-gray-600">
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
                รหัสลูกแชร์จะถูกสร้างอัตโนมัติ (A001, A002, ...)
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
                <label className="block text-sm font-medium text-gray-700">ที่อยู่</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
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

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); resetForm(); setError(''); }}
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
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">แก้ไขลูกแชร์</h2>
              <button onClick={() => { setShowEditModal(false); setEditingMember(null); resetForm(); setError(''); }} className="text-gray-400 hover:text-gray-600">
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
                  {editingMember.memberCode}
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
                <label className="block text-sm font-medium text-gray-700">ที่อยู่</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
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

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingMember(null); resetForm(); setError(''); }}
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
