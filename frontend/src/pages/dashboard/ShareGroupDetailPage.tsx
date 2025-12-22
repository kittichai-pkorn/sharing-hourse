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
  userId: number | null;
  user?: {
    firstName: string;
    lastName: string;
  };
}

interface Round {
  id: number;
  roundNumber: number;
  dueDate: string;
  status: string;
  winnerId: number | null;
  winningBid: number | null;
  payoutAmount: number | null;
  winner?: {
    id: number;
    memberCode: string;
    nickname: string;
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
  hostId: number;
  managementFee: number | null;
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
  const [rounds, setRounds] = useState<Round[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({
    nickname: '',
    address: '',
    phone: '',
    lineId: '',
  });
  const [winnerFormData, setWinnerFormData] = useState({
    memberId: 0,
    interest: 0,
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'members' | 'rounds'>('members');

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

  const fetchRounds = async () => {
    try {
      const response = await api.get(`/rounds/group/${id}`);
      setRounds(response.data.data);
    } catch (err) {
      console.error('Failed to fetch rounds:', err);
    }
  };

  const generateRounds = async () => {
    try {
      await api.post(`/rounds/generate/${id}`);
      setMessage('สร้างตารางงวดเรียบร้อยแล้ว');
      fetchRounds();
    } catch (err: any) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาด');
    }
  };

  useEffect(() => {
    fetchGroup();
    fetchRounds();
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

  const openWinnerModal = (round: Round) => {
    setSelectedRound(round);

    // Get members who haven't won yet
    const availableMembers = group?.members.filter(m => !m.hasWon) || [];

    // Find host member
    const hostMember = group?.members.find(m => m.userId === group?.hostId);

    // Determine default winner based on round rules
    let defaultMemberId = 0;
    let isLocked = false;

    if (round.roundNumber === 1 && hostMember) {
      // First round: host wins
      defaultMemberId = hostMember.id;
      isLocked = true;
    } else if (availableMembers.length === 1) {
      // Last round: only one member left
      defaultMemberId = availableMembers[0].id;
      isLocked = true;
    }

    setWinnerFormData({
      memberId: defaultMemberId,
      interest: 0,
    });
    setShowWinnerModal(true);
  };

  const handleRecordWinner = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedRound || !winnerFormData.memberId) {
      setError('กรุณาเลือกผู้ชนะ');
      return;
    }

    try {
      await api.post(`/rounds/${selectedRound.id}/winner`, {
        memberId: winnerFormData.memberId,
        interest: winnerFormData.interest,
      });
      setMessage('บันทึกผู้ชนะเรียบร้อยแล้ว');
      setShowWinnerModal(false);
      setSelectedRound(null);
      fetchGroup();
      fetchRounds();
    } catch (err: any) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาด');
    }
  };

  // Calculate payout for preview
  const calculatePayout = () => {
    if (!group) return 0;
    const totalPool = group.principalAmount * group.maxMembers;
    const interest = winnerFormData.interest || 0;
    const managementFee = group.managementFee || 0;
    return totalPool - interest - managementFee;
  };

  // Get available members (those who haven't won)
  const getAvailableMembers = () => {
    return group?.members.filter(m => !m.hasWon) || [];
  };

  // Check if it's first round
  const isFirstRound = () => selectedRound?.roundNumber === 1;

  // Check if it's last round (only 1 member left)
  const isLastRound = () => getAvailableMembers().length === 1;

  // Get current round (first round without winner)
  const getCurrentRound = () => {
    return rounds.find(r => !r.winnerId);
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

      {/* Tabs */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="border-b">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('members')}
              className={`px-6 py-4 text-sm font-medium ${
                activeTab === 'members'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              สมาชิก ({group.members.length}/{group.maxMembers})
            </button>
            <button
              onClick={() => setActiveTab('rounds')}
              className={`px-6 py-4 text-sm font-medium ${
                activeTab === 'rounds'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              งวด ({rounds.filter(r => r.winnerId).length}/{rounds.length})
            </button>
          </nav>
        </div>

        {/* Members Tab */}
        {activeTab === 'members' && (
          <>
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <div>
                {group.summary && (
                  <div className="flex gap-4 text-sm">
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
          </>
        )}

        {/* Rounds Tab */}
        {activeTab === 'rounds' && (
          <div className="p-6">
            {rounds.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">ยังไม่มีตารางงวด</p>
                {group.status === 'DRAFT' && group.members.length === group.maxMembers && (
                  <button
                    onClick={generateRounds}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    สร้างตารางงวด
                  </button>
                )}
                {group.status === 'DRAFT' && group.members.length < group.maxMembers && (
                  <p className="text-sm text-orange-600 mt-2">
                    ต้องเพิ่มสมาชิกให้ครบ {group.maxMembers} คนก่อน (ปัจจุบัน {group.members.length} คน)
                  </p>
                )}
              </div>
            ) : (
              <>
                {/* Rounds Timeline */}
                <div className="mb-6 overflow-x-auto">
                  <div className="flex gap-4 min-w-max pb-4">
                    {rounds.map((round, index) => {
                      const isCompleted = round.status === 'COMPLETED';
                      const isCurrent = !round.winnerId && (index === 0 || rounds[index - 1]?.winnerId);

                      return (
                        <div key={round.id} className="flex items-center">
                          <div
                            className={`flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity ${
                              isCurrent ? 'scale-105' : ''
                            }`}
                            onClick={() => !isCompleted && isCurrent && group.status === 'ACTIVE' && openWinnerModal(round)}
                          >
                            {/* Circle */}
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                                isCompleted
                                  ? 'bg-green-500 text-white'
                                  : isCurrent
                                  ? 'bg-blue-500 text-white ring-4 ring-blue-200'
                                  : 'bg-gray-200 text-gray-500'
                              }`}
                            >
                              {isCompleted ? '✓' : round.roundNumber}
                            </div>

                            {/* Info */}
                            <div className="mt-2 text-center">
                              <p className="text-xs font-medium">งวด {round.roundNumber}</p>
                              {round.winner && (
                                <p className="text-xs text-gray-500">{round.winner.nickname}</p>
                              )}
                              {round.winningBid !== null && round.winningBid > 0 && (
                                <p className="text-xs text-green-600">{round.winningBid.toLocaleString()} บาท</p>
                              )}
                              {!round.winnerId && isCurrent && group.status === 'ACTIVE' && (
                                <p className="text-xs text-blue-600">คลิกบันทึก</p>
                              )}
                            </div>
                          </div>

                          {/* Connector */}
                          {index < rounds.length - 1 && (
                            <div
                              className={`w-8 h-0.5 mx-2 ${
                                isCompleted ? 'bg-green-500' : 'bg-gray-200'
                              }`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Rounds Table */}
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">งวด</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">กำหนดชำระ</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ผู้ชนะ</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ดอกเบี้ย</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ได้รับ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {rounds.map((round) => (
                      <tr key={round.id} className={round.winnerId ? '' : 'bg-gray-50'}>
                        <td className="px-4 py-3 text-sm font-medium">{round.roundNumber}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(round.dueDate).toLocaleDateString('th-TH')}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {round.status === 'COMPLETED' ? (
                            <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">สำเร็จ</span>
                          ) : (
                            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">รอ</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">{round.winner?.nickname || '-'}</td>
                        <td className="px-4 py-3 text-sm text-right">
                          {round.winningBid !== null ? round.winningBid.toLocaleString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                          {round.payoutAmount !== null ? round.payoutAmount.toLocaleString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
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

      {/* Record Winner Modal */}
      {showWinnerModal && selectedRound && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">
                บันทึกผู้ชนะ - งวดที่ {selectedRound.roundNumber}
                {isLastRound() && ' (งวดสุดท้าย)'}
              </h2>
              <button
                onClick={() => { setShowWinnerModal(false); setSelectedRound(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                &#x2715;
              </button>
            </div>

            <form onSubmit={handleRecordWinner} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded text-sm">
                  {error}
                </div>
              )}

              {/* Info messages */}
              {isFirstRound() && (
                <div className="text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded">
                  งวดแรกเป็นสิทธิ์ของท้าวแชร์
                </div>
              )}
              {isLastRound() && (
                <div className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded">
                  งวดสุดท้าย - ได้รับเงินเต็ม (ไม่หักดอก)
                </div>
              )}

              {/* Winner Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700">ผู้ชนะ *</label>
                <select
                  value={winnerFormData.memberId}
                  onChange={(e) => setWinnerFormData({ ...winnerFormData, memberId: parseInt(e.target.value) })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  disabled={isFirstRound() || isLastRound()}
                  required
                >
                  <option value={0}>เลือกผู้ชนะ</option>
                  {getAvailableMembers().map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.memberCode} - {member.nickname}
                      {member.userId === group?.hostId ? ' (ท้าวแชร์)' : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  แสดงเฉพาะคนที่ยังไม่เปีย ({getAvailableMembers().length} คน)
                </p>
              </div>

              {/* Interest Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700">ดอกเบี้ย (บาท)</label>
                <input
                  type="number"
                  min={0}
                  value={winnerFormData.interest}
                  onChange={(e) => setWinnerFormData({ ...winnerFormData, interest: parseInt(e.target.value) || 0 })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  disabled={isFirstRound() || isLastRound()}
                />
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">สรุป</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">เงินกองกลาง:</span>
                    <span className="font-medium">
                      {(group?.principalAmount || 0) * (group?.maxMembers || 0).toLocaleString()} บาท
                    </span>
                  </div>
                  {winnerFormData.interest > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>- ดอกเบี้ย:</span>
                      <span>-{winnerFormData.interest.toLocaleString()} บาท</span>
                    </div>
                  )}
                  {group?.managementFee && group.managementFee > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>- ค่าดูแลวง:</span>
                      <span>-{group.managementFee.toLocaleString()} บาท</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between font-medium text-green-600">
                    <span>ได้รับจริง:</span>
                    <span>{calculatePayout().toLocaleString()} บาท</span>
                  </div>
                </div>
              </div>

              {/* Last round note */}
              {isLastRound() && (
                <div className="text-sm text-orange-600 bg-orange-50 px-3 py-2 rounded">
                  วงจะปิดหลังยืนยันงวดนี้
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowWinnerModal(false); setSelectedRound(null); }}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  {isFirstRound() || isLastRound() ? 'ยืนยัน' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
