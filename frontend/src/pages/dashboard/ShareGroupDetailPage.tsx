import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/client';

interface DeductionTemplate {
  id: number;
  name: string;
  amount: number;
}

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
  deductionTemplates: DeductionTemplate[];
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
  const [activeTab, setActiveTab] = useState<'members' | 'rounds' | 'deductions' | 'summary'>('members');

  // Deduction states
  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [editingDeduction, setEditingDeduction] = useState<DeductionTemplate | null>(null);
  const [deductionFormData, setDeductionFormData] = useState({ name: '', amount: 0 });

  // Group status states
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Summary/Report states
  const [summaryData, setSummaryData] = useState<any>(null);
  const [memberHistoryData, setMemberHistoryData] = useState<any>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  // Round Deductions Modal states
  const [showRoundDeductionModal, setShowRoundDeductionModal] = useState(false);
  const [selectedRoundForDeduction, setSelectedRoundForDeduction] = useState<Round | null>(null);
  const [roundDeductionItems, setRoundDeductionItems] = useState<{ id?: number; name: string; amount: number }[]>([]);

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

  const fetchSummary = async () => {
    setIsSummaryLoading(true);
    try {
      const [summaryRes, historyRes] = await Promise.all([
        api.get(`/share-groups/${id}/summary`),
        api.get(`/share-groups/${id}/members/history`),
      ]);
      setSummaryData(summaryRes.data.data);
      setMemberHistoryData(historyRes.data.data);
    } catch (err) {
      console.error('Failed to fetch summary:', err);
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const openRoundDeductionModal = async (round: Round) => {
    setSelectedRoundForDeduction(round);
    setError('');
    try {
      const response = await api.get(`/deductions/round/${round.id}`);
      const deductions = response.data.data || [];
      setRoundDeductionItems(deductions.map((d: any) => ({
        id: d.id,
        name: d.note || d.type,
        amount: d.amount,
      })));
      setShowRoundDeductionModal(true);
    } catch (err) {
      // If no deductions yet, start with template
      const templateItems = group?.deductionTemplates?.map((t) => ({
        name: t.name,
        amount: t.amount,
      })) || [];
      setRoundDeductionItems(templateItems);
      setShowRoundDeductionModal(true);
    }
  };

  const handleAddDeductionItem = () => {
    setRoundDeductionItems([...roundDeductionItems, { name: '', amount: 0 }]);
  };

  const handleRemoveDeductionItem = (index: number) => {
    setRoundDeductionItems(roundDeductionItems.filter((_, i) => i !== index));
  };

  const handleDeductionItemChange = (index: number, field: 'name' | 'amount', value: string | number) => {
    const updated = [...roundDeductionItems];
    if (field === 'amount') {
      updated[index].amount = typeof value === 'string' ? parseInt(value) || 0 : value;
    } else {
      updated[index].name = value as string;
    }
    setRoundDeductionItems(updated);
  };

  const handleSaveRoundDeductions = async () => {
    if (!selectedRoundForDeduction) return;

    try {
      await api.post(`/deductions/round/${selectedRoundForDeduction.id}`, {
        deductions: roundDeductionItems.filter(d => d.name && d.amount > 0),
      });
      setMessage('บันทึกรายการหักรับเรียบร้อยแล้ว');
      setShowRoundDeductionModal(false);
      setSelectedRoundForDeduction(null);
      fetchRounds();
    } catch (err: any) {
      setError(err.response?.data?.message || 'เกิดข้อผิดพลาด');
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

  useEffect(() => {
    if (activeTab === 'summary' && !summaryData) {
      fetchSummary();
    }
  }, [activeTab]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await api.post(`/members/group/${id}`, formData);
      setMessage('เพิ่มลูกแชร์เรียบร้อยแล้ว');
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
    if (!confirm('ต้องการลบลูกแชร์นี้?')) return;

    try {
      await api.delete(`/members/${memberId}`);
      setMessage('ลบลูกแชร์เรียบร้อยแล้ว');
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

  // Deduction CRUD handlers
  const openAddDeductionModal = () => {
    setEditingDeduction(null);
    setDeductionFormData({ name: '', amount: 0 });
    setShowDeductionModal(true);
  };

  const openEditDeductionModal = (deduction: DeductionTemplate) => {
    setEditingDeduction(deduction);
    setDeductionFormData({ name: deduction.name, amount: deduction.amount });
    setShowDeductionModal(true);
  };

  const handleSaveDeduction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!deductionFormData.name.trim()) {
      setError('กรุณากรอกชื่อรายการ');
      return;
    }

    try {
      if (editingDeduction) {
        await api.put(`/share-groups/${id}/deductions/${editingDeduction.id}`, deductionFormData);
        setMessage('แก้ไขรายการหักรับเรียบร้อยแล้ว');
      } else {
        await api.post(`/share-groups/${id}/deductions`, deductionFormData);
        setMessage('เพิ่มรายการหักรับเรียบร้อยแล้ว');
      }
      setShowDeductionModal(false);
      setEditingDeduction(null);
      fetchGroup();
    } catch (err: any) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาด');
    }
  };

  const handleDeleteDeduction = async (deductionId: number) => {
    if (!confirm('ต้องการลบรายการหักรับนี้?')) return;

    try {
      await api.delete(`/share-groups/${id}/deductions/${deductionId}`);
      setMessage('ลบรายการหักรับเรียบร้อยแล้ว');
      fetchGroup();
    } catch (err: any) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาด');
    }
  };

  // Calculate total deductions
  const getTotalDeductions = () => {
    return group?.deductionTemplates?.reduce((sum, d) => sum + d.amount, 0) || 0;
  };

  // Group status handlers
  const handleOpenGroup = async () => {
    setError('');
    try {
      await api.post(`/share-groups/${id}/open`);
      setMessage('เปิดวงเรียบร้อยแล้ว');
      setShowOpenModal(false);
      fetchGroup();
      fetchRounds();
    } catch (err: any) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาด');
    }
  };

  const handleCancelGroup = async () => {
    setError('');
    try {
      await api.post(`/share-groups/${id}/cancel`, { reason: cancelReason });
      setMessage('ยกเลิกวงเรียบร้อยแล้ว');
      setShowCancelModal(false);
      setCancelReason('');
      fetchGroup();
    } catch (err: any) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาด');
    }
  };

  // Check if group can be opened
  const canOpenGroup = () => {
    return group?.status === 'DRAFT' &&
           group.members.length >= group.maxMembers &&
           rounds.length > 0;
  };

  // Get status badge
  const getStatusBadge = () => {
    switch (group?.status) {
      case 'DRAFT':
        return <span className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded-full">ร่าง</span>;
      case 'OPEN':
        return <span className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded-full">เปิดวง</span>;
      case 'IN_PROGRESS':
        return <span className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 rounded-full">กำลังดำเนินการ</span>;
      case 'COMPLETED':
        return <span className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">เสร็จสิ้น</span>;
      case 'CANCELLED':
        return <span className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded-full">ยกเลิก</span>;
      default:
        return null;
    }
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

    // Confirmation dialog
    const selectedMember = group?.members.find(m => m.id === winnerFormData.memberId);
    const confirmMessage = isLastRound()
      ? `ยืนยันบันทึก ${selectedMember?.nickname} เป็นผู้ชนะงวดสุดท้าย?\n\nวงจะปิดหลังจากนี้`
      : `ยืนยันบันทึก ${selectedMember?.nickname} เป็นผู้ชนะงวดที่ ${selectedRound.roundNumber}?`;

    if (!confirm(confirmMessage)) return;

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
    const totalDeductions = getTotalDeductions();
    return totalPool - interest - totalDeductions;
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
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
            <div className="mt-2">{getStatusBadge()}</div>
          </div>
          <div className="flex gap-2">
            {group.status === 'DRAFT' && (
              <>
                <button
                  onClick={() => setShowOpenModal(true)}
                  disabled={!canOpenGroup()}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    canOpenGroup()
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  เปิดวง
                </button>
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="px-4 py-2 bg-red-100 text-red-600 rounded-md text-sm font-medium hover:bg-red-200"
                >
                  ยกเลิกวง
                </button>
              </>
            )}
          </div>
        </div>
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
            <span className="text-gray-500">ลูกแชร์:</span>
            <p className="font-medium">{group.members.length}/{group.maxMembers} คน</p>
          </div>
          <div>
            <span className="text-gray-500">เงินกองกลาง:</span>
            <p className="font-medium">{(group.principalAmount * group.maxMembers).toLocaleString()} บาท</p>
          </div>
        </div>

        {/* Show message if group can't be opened */}
        {group.status === 'DRAFT' && !canOpenGroup() && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded text-sm">
            {group.members.length < group.maxMembers && (
              <p>ต้องเพิ่มลูกแชร์ให้ครบ {group.maxMembers} คน (ปัจจุบัน {group.members.length} คน)</p>
            )}
            {rounds.length === 0 && (
              <p>ต้องสร้างตารางงวดก่อนเปิดวง</p>
            )}
          </div>
        )}

        {/* Show completion summary */}
        {group.status === 'COMPLETED' && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-800 mb-2">สรุปวง</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-blue-600">งวดทั้งหมด:</span>
                <p className="font-medium">{rounds.length} งวด</p>
              </div>
              <div>
                <span className="text-blue-600">เงินหมุนเวียนรวม:</span>
                <p className="font-medium">{(group.principalAmount * group.maxMembers * rounds.length).toLocaleString()} บาท</p>
              </div>
              <div>
                <span className="text-blue-600">ดอกเบี้ยรวม:</span>
                <p className="font-medium">{rounds.reduce((sum, r) => sum + (r.winningBid || 0), 0).toLocaleString()} บาท</p>
              </div>
            </div>
          </div>
        )}
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
              ลูกแชร์ ({group.members.length}/{group.maxMembers})
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
            <button
              onClick={() => setActiveTab('deductions')}
              className={`px-6 py-4 text-sm font-medium ${
                activeTab === 'deductions'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              รายการหักรับ ({group.deductionTemplates?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-6 py-4 text-sm font-medium ${
                activeTab === 'summary'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              รายงาน
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
                  + เพิ่มลูกแชร์
                </button>
              )}
            </div>

            {group.members.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                ยังไม่มีลูกแชร์
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
                    ต้องเพิ่มลูกแชร์ให้ครบ {group.maxMembers} คนก่อน (ปัจจุบัน {group.members.length} คน)
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
                            onClick={() => !isCompleted && isCurrent && group.status === 'OPEN' && openWinnerModal(round)}
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
                              {!round.winnerId && isCurrent && group.status === 'OPEN' && (
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
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
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
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => openRoundDeductionModal(round)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            จัดการ
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {/* Deductions Tab */}
        {activeTab === 'deductions' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-medium">รายการหักรับ</h3>
                <p className="text-sm text-gray-500">รายการที่จะหักจากผู้ชนะทุกงวด</p>
              </div>
              {group.status === 'DRAFT' && (
                <button
                  onClick={openAddDeductionModal}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  + เพิ่มรายการ
                </button>
              )}
            </div>

            {group.status !== 'DRAFT' && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-4 text-sm">
                ไม่สามารถแก้ไขรายการหักรับหลังเปิดวงแล้ว
              </div>
            )}

            {!group.deductionTemplates || group.deductionTemplates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                ยังไม่มีรายการหักรับ
              </div>
            ) : (
              <>
                <table className="min-w-full divide-y divide-gray-200 mb-4">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">รายการ</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">จำนวน</th>
                      {group.status === 'DRAFT' && (
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {group.deductionTemplates.map((deduction) => (
                      <tr key={deduction.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {deduction.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {deduction.amount.toLocaleString()} บาท
                        </td>
                        {group.status === 'DRAFT' && (
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <button
                              onClick={() => openEditDeductionModal(deduction)}
                              className="text-blue-600 hover:text-blue-900 mr-3"
                            >
                              แก้ไข
                            </button>
                            <button
                              onClick={() => handleDeleteDeduction(deduction.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              ลบ
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">รวมหักรับต่องวด</td>
                      <td className="px-6 py-3 text-sm text-right font-medium text-red-600">
                        {getTotalDeductions().toLocaleString()} บาท
                      </td>
                      {group.status === 'DRAFT' && <td></td>}
                    </tr>
                  </tfoot>
                </table>

                {/* Preview payout */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-800 mb-2">ตัวอย่างเงินที่ผู้ชนะจะได้รับ</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-600">เงินกองกลาง:</span>
                      <span className="font-medium">{(group.principalAmount * group.maxMembers).toLocaleString()} บาท</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>- รายการหักรับ:</span>
                      <span>-{getTotalDeductions().toLocaleString()} บาท</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>- ดอกเบี้ย (ถ้ามี):</span>
                      <span>ขึ้นอยู่กับการประมูล</span>
                    </div>
                    <div className="border-t border-blue-200 pt-1 flex justify-between font-medium text-green-600">
                      <span>ได้รับสูงสุด:</span>
                      <span>{((group.principalAmount * group.maxMembers) - getTotalDeductions()).toLocaleString()} บาท</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Summary/Report Tab */}
        {activeTab === 'summary' && (
          <div className="p-6">
            {isSummaryLoading ? (
              <div className="text-center py-8 text-gray-500">กำลังโหลดรายงาน...</div>
            ) : !summaryData ? (
              <div className="text-center py-8 text-gray-500">ไม่สามารถโหลดรายงานได้</div>
            ) : (
              <div className="space-y-8">
                {/* Financial Summary */}
                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                    <span>📊</span> สรุปการเงิน
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-500">เงินต้นต่องวด</p>
                      <p className="text-xl font-bold text-gray-900">
                        {summaryData.financial.principalPerRound.toLocaleString()} บาท
                      </p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-blue-600">เงินกองกลางต่องวด</p>
                      <p className="text-xl font-bold text-blue-700">
                        {summaryData.financial.poolPerRound.toLocaleString()} บาท
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-green-600">เงินหมุนเวียนรวม</p>
                      <p className="text-xl font-bold text-green-700">
                        {summaryData.financial.totalPool.toLocaleString()} บาท
                      </p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4">
                      <p className="text-sm text-orange-600">งวดที่เสร็จสิ้น</p>
                      <p className="text-xl font-bold text-orange-700">
                        {summaryData.financial.completedRounds}/{summaryData.financial.totalRounds}
                      </p>
                    </div>
                  </div>

                  {/* More financial details */}
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div className="bg-yellow-50 rounded-lg p-4">
                      <p className="text-sm text-yellow-600">ดอกเบี้ยรวม</p>
                      <p className="text-lg font-bold text-yellow-700">
                        {summaryData.financial.totalInterest.toLocaleString()} บาท
                      </p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4">
                      <p className="text-sm text-red-600">รายการหักรับรวม</p>
                      <p className="text-lg font-bold text-red-700">
                        {summaryData.financial.totalDeductions.toLocaleString()} บาท
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-sm text-purple-600">จ่ายผู้ชนะรวม</p>
                      <p className="text-lg font-bold text-purple-700">
                        {summaryData.financial.totalPayout.toLocaleString()} บาท
                      </p>
                    </div>
                  </div>
                </div>

                {/* Rounds Summary Table */}
                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                    <span>📋</span> รายงวด
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">งวด</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">กำหนด</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ผู้ชนะ</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ดอก</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">หัก</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ได้รับ</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {summaryData.rounds.map((round: any) => (
                          <tr key={round.roundNumber} className={round.status === 'COMPLETED' ? '' : 'bg-gray-50'}>
                            <td className="px-4 py-3 text-sm font-medium">{round.roundNumber}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {new Date(round.dueDate).toLocaleDateString('th-TH')}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {round.status === 'COMPLETED' ? round.winnerName : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              {round.status === 'COMPLETED' ? round.interest.toLocaleString() : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-red-600">
                              {round.status === 'COMPLETED' ? round.deductions.toLocaleString() : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                              {round.status === 'COMPLETED' ? round.payout.toLocaleString() : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-100">
                        <tr>
                          <td colSpan={3} className="px-4 py-3 text-sm font-medium">รวมทั้งหมด</td>
                          <td className="px-4 py-3 text-sm text-right font-medium">
                            {summaryData.financial.totalInterest.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-red-600">
                            {summaryData.financial.totalDeductions.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                            {summaryData.financial.totalPayout.toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Member History */}
                {memberHistoryData && (
                  <div>
                    <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                      <span>👥</span> ประวัติสมาชิก
                    </h3>

                    {/* Stats */}
                    {memberHistoryData.stats.wonCount > 0 && (
                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div className="bg-blue-50 rounded-lg p-3">
                          <p className="text-xs text-blue-600">เปียแล้ว</p>
                          <p className="text-lg font-bold text-blue-700">
                            {memberHistoryData.stats.wonCount}/{memberHistoryData.stats.totalMembers}
                          </p>
                        </div>
                        <div className="bg-yellow-50 rounded-lg p-3">
                          <p className="text-xs text-yellow-600">ดอกต่ำสุด</p>
                          <p className="text-lg font-bold text-yellow-700">
                            {memberHistoryData.stats.minInterest.toLocaleString()}
                          </p>
                          <p className="text-xs text-yellow-500">{memberHistoryData.stats.minInterestMember}</p>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-3">
                          <p className="text-xs text-orange-600">ดอกสูงสุด</p>
                          <p className="text-lg font-bold text-orange-700">
                            {memberHistoryData.stats.maxInterest.toLocaleString()}
                          </p>
                          <p className="text-xs text-orange-500">{memberHistoryData.stats.maxInterestMember}</p>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-3">
                          <p className="text-xs text-purple-600">ดอกเฉลี่ย</p>
                          <p className="text-lg font-bold text-purple-700">
                            {memberHistoryData.stats.avgInterest.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ชื่อ</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">งวด</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ดอก</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ได้รับ</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {memberHistoryData.members.map((member: any) => (
                            <tr key={member.id} className={member.hasWon ? '' : 'bg-gray-50'}>
                              <td className="px-4 py-3 text-sm">{member.order}</td>
                              <td className="px-4 py-3 text-sm">
                                {member.isHost && <span className="mr-1">👑</span>}
                                {member.name}
                              </td>
                              <td className="px-4 py-3 text-sm text-center">
                                {member.hasWon ? (
                                  <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                                    {member.roundNumber}
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded-full">
                                    รอ
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-right">
                                {member.hasWon ? member.interest.toLocaleString() : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                                {member.hasWon ? member.payout.toLocaleString() : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">เพิ่มลูกแชร์</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
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
                  onClick={() => setShowAddModal(false)}
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
              <h2 className="text-lg font-medium">แก้ไขลูกแชร์</h2>
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
                  แสดงเฉพาะลูกแชร์ที่ยังไม่เปีย ({getAvailableMembers().length} คน)
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
                <h3 className="text-sm font-medium text-gray-700 mb-3">สรุปรายการหักรับ</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">เงินกองกลาง:</span>
                    <span className="font-medium">
                      {((group?.principalAmount || 0) * (group?.maxMembers || 0)).toLocaleString()} บาท
                    </span>
                  </div>
                  {winnerFormData.interest > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>- ดอกเบี้ย:</span>
                      <span>-{winnerFormData.interest.toLocaleString()} บาท</span>
                    </div>
                  )}
                  {group?.deductionTemplates && group.deductionTemplates.length > 0 && (
                    <>
                      {group.deductionTemplates.map((d) => (
                        <div key={d.id} className="flex justify-between text-red-600">
                          <span>- {d.name}:</span>
                          <span>-{d.amount.toLocaleString()} บาท</span>
                        </div>
                      ))}
                    </>
                  )}
                  {getTotalDeductions() > 0 && (
                    <div className="flex justify-between text-gray-500 text-xs border-t pt-1">
                      <span>รวมหักรับ:</span>
                      <span>{(winnerFormData.interest + getTotalDeductions()).toLocaleString()} บาท</span>
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

      {/* Deduction Modal */}
      {showDeductionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">
                {editingDeduction ? 'แก้ไขรายการหักรับ' : 'เพิ่มรายการหักรับ'}
              </h2>
              <button
                onClick={() => { setShowDeductionModal(false); setEditingDeduction(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                &#x2715;
              </button>
            </div>

            <form onSubmit={handleSaveDeduction} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">ชื่อรายการ *</label>
                <input
                  type="text"
                  required
                  value={deductionFormData.name}
                  onChange={(e) => setDeductionFormData({ ...deductionFormData, name: e.target.value })}
                  placeholder="เช่น ค่าดูแลวง, หักท้ายท้าว"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">จำนวนเงิน (บาท) *</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={deductionFormData.amount || ''}
                  onChange={(e) => setDeductionFormData({ ...deductionFormData, amount: parseInt(e.target.value) || 0 })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowDeductionModal(false); setEditingDeduction(null); }}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  {editingDeduction ? 'บันทึก' : 'เพิ่ม'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Open Group Modal */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">ยืนยันการเปิดวง</h2>
              <button
                onClick={() => setShowOpenModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                &#x2715;
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">วง:</span>
                  <span className="font-medium">{group?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ลูกแชร์:</span>
                  <span className="font-medium text-green-600">{group?.members.length}/{group?.maxMembers} คน</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">งวดทั้งหมด:</span>
                  <span className="font-medium">{rounds.length} งวด</span>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded text-sm">
                <p className="font-medium mb-1">หลังเปิดวงแล้ว:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>ไม่สามารถแก้ไขข้อมูลวงได้</li>
                  <li>ไม่สามารถเพิ่ม/ลบลูกแชร์ได้</li>
                  <li>ไม่สามารถแก้ไขรายการหักรับได้</li>
                </ul>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowOpenModal(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleOpenGroup}
                  className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                >
                  เปิดวง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Group Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">ยืนยันการยกเลิกวง</h2>
              <button
                onClick={() => { setShowCancelModal(false); setCancelReason(''); }}
                className="text-gray-400 hover:text-gray-600"
              >
                &#x2715;
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-gray-600">
                คุณต้องการยกเลิกวง <strong>"{group?.name}"</strong> หรือไม่?
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700">เหตุผล (ไม่บังคับ)</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  placeholder="ระบุเหตุผลที่ยกเลิก..."
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                การยกเลิกไม่สามารถย้อนกลับได้
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowCancelModal(false); setCancelReason(''); }}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  ไม่ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleCancelGroup}
                  className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                >
                  ยกเลิกวง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Round Deductions Modal (Story 6.2) */}
      {showRoundDeductionModal && selectedRoundForDeduction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">
                รายการหักรับ - งวดที่ {selectedRoundForDeduction.roundNumber}
              </h2>
              <button
                onClick={() => {
                  setShowRoundDeductionModal(false);
                  setSelectedRoundForDeduction(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                &#x2715;
              </button>
            </div>

            <div className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded text-sm">
                  {error}
                </div>
              )}

              {/* Round Info */}
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">กำหนดชำระ:</span>
                  <span>{new Date(selectedRoundForDeduction.dueDate).toLocaleDateString('th-TH')}</span>
                </div>
                {selectedRoundForDeduction.winner && (
                  <div className="flex justify-between mt-1">
                    <span className="text-gray-500">ผู้ชนะ:</span>
                    <span className="font-medium">{selectedRoundForDeduction.winner.nickname}</span>
                  </div>
                )}
              </div>

              {/* Interest (read-only) */}
              {selectedRoundForDeduction.winningBid !== null && selectedRoundForDeduction.winningBid > 0 && (
                <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                  <span className="text-sm font-medium">ดอกเบี้ย</span>
                  <span className="text-sm text-red-600 font-medium">
                    {selectedRoundForDeduction.winningBid.toLocaleString()} บาท
                  </span>
                </div>
              )}

              {/* Editable Deductions List */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-medium text-gray-700">รายการหักรับ</h3>
                  <button
                    type="button"
                    onClick={handleAddDeductionItem}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    + เพิ่มรายการ
                  </button>
                </div>
                <div className="space-y-2">
                  {roundDeductionItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleDeductionItemChange(index, 'name', e.target.value)}
                        placeholder="ชื่อรายการ"
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                      <input
                        type="number"
                        min={0}
                        value={item.amount || ''}
                        onChange={(e) => handleDeductionItemChange(index, 'amount', e.target.value)}
                        placeholder="0"
                        className="w-24 px-2 py-1 text-sm border border-gray-300 rounded text-right"
                      />
                      <span className="text-xs text-gray-500">บาท</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDeductionItem(index)}
                        className="text-red-400 hover:text-red-600 p-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {roundDeductionItems.length === 0 && (
                    <div className="text-center py-4 text-gray-400 text-sm">
                      ยังไม่มีรายการหักรับ
                    </div>
                  )}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-blue-600">รวมหักรับ:</span>
                  <span className="font-medium text-red-600">
                    {(
                      (selectedRoundForDeduction.winningBid || 0) +
                      roundDeductionItems.reduce((sum, d) => sum + (d.amount || 0), 0)
                    ).toLocaleString()} บาท
                  </span>
                </div>
                <div className="border-t border-blue-200 pt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-600">เงินกองกลาง:</span>
                    <span className="font-medium">
                      {((group?.principalAmount || 0) * (group?.maxMembers || 0)).toLocaleString()} บาท
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-green-600 font-medium">ผู้ชนะได้รับ:</span>
                    <span className="font-bold text-green-600">
                      {(
                        (group?.principalAmount || 0) * (group?.maxMembers || 0) -
                        (selectedRoundForDeduction.winningBid || 0) -
                        roundDeductionItems.reduce((sum, d) => sum + (d.amount || 0), 0)
                      ).toLocaleString()} บาท
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowRoundDeductionModal(false);
                    setSelectedRoundForDeduction(null);
                  }}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  ปิด
                </button>
                <button
                  type="button"
                  onClick={handleSaveRoundDeductions}
                  className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
