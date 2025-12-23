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
  interestRate: number | null;
  members: Member[];
  deductionTemplates: DeductionTemplate[];
  summary: {
    wonCount: number;
    notWonCount: number;
    totalMembers: number;
    maxMembers: number;
  };
}


interface PaymentScheduleMember {
  id: number;
  order: number;
  memberCode: string | null;
  nickname: string;
  name: string;
  isHost: boolean;
  wonRound: number | null;
  payments: {
    roundNumber: number;
    dueDate: string;
    amount: number;
    status: 'PENDING' | 'PAID' | 'WON';
  }[];
  totalPayment: number;
  totalPaid: number;
}

interface RoundPayment {
  id: number | null;
  groupMemberId: number;
  memberCode: string | null;
  nickname: string;
  isHost: boolean;
  isWinner: boolean;
  amount: number;
  isPaid: boolean | null;
  paidAt: string | null;
  note: string | null;
}

interface RoundPaymentsData {
  roundId: number;
  roundNumber: number;
  dueDate: string;
  principalAmount: number;
  totalMembers: number;
  paidCount: number;
  paidAmount: number;
  totalAmount: number;
  winnerId: number | null;
  payments: RoundPayment[];
}

interface PaymentSchedule {
  groupId: number;
  groupName: string;
  principalAmount: number;
  totalRounds: number;
  rounds: {
    roundNumber: number;
    dueDate: string;
    winnerId: number | null;
    winnerName: string | null;
    status: string;
  }[];
  members: PaymentScheduleMember[];
}

const typeLabels: Record<string, string> = {
  STEP_INTEREST: 'ขั้นบันได',
  BID_INTEREST: 'บิทดอกตาม',
  FIXED_INTEREST: 'ดอกตาม',
  BID_PRINCIPAL: 'บิทลดต้น (หักดอกท้าย)',
  BID_PRINCIPAL_FIRST: 'บิทลดต้น (หักดอกหน้า)',
};

const typeColors: Record<string, string> = {
  STEP_INTEREST: 'bg-purple-100 text-purple-700',
  BID_INTEREST: 'bg-orange-100 text-orange-700',
  FIXED_INTEREST: 'bg-blue-100 text-blue-700',
  BID_PRINCIPAL: 'bg-teal-100 text-teal-700',
  BID_PRINCIPAL_FIRST: 'bg-cyan-100 text-cyan-700',
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

  // Deduction states
  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [editingDeduction, setEditingDeduction] = useState<DeductionTemplate | null>(null);
  const [deductionFormData, setDeductionFormData] = useState({ name: '', amount: 0 });

  // Group status states
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');


  // Round Deductions Modal states
  const [showRoundDeductionModal, setShowRoundDeductionModal] = useState(false);
  const [selectedRoundForDeduction, setSelectedRoundForDeduction] = useState<Round | null>(null);
  const [roundDeductionItems, setRoundDeductionItems] = useState<{ id?: number; name: string; amount: number }[]>([]);
  const [roundModalTab, setRoundModalTab] = useState<'deductions' | 'payments'>('deductions');
  const [roundPaymentsData, setRoundPaymentsData] = useState<RoundPaymentsData | null>(null);
  const [roundPaymentsLoading, setRoundPaymentsLoading] = useState(false);
  const [localPayments, setLocalPayments] = useState<{ [key: number]: boolean }>({});

  // Payment Schedule Modal states
  const [showPaymentScheduleModal, setShowPaymentScheduleModal] = useState(false);
  const [paymentScheduleData, setPaymentScheduleData] = useState<PaymentSchedule | null>(null);
  const [isPaymentScheduleLoading, setIsPaymentScheduleLoading] = useState(false);
  const [expandedMembers, setExpandedMembers] = useState<Set<number>>(new Set());

  // Inline edit interest states
  const [editingInterestRoundId, setEditingInterestRoundId] = useState<number | null>(null);
  const [editInterestValue, setEditInterestValue] = useState<string>('');
  const [savingInterest, setSavingInterest] = useState(false);

  // Modal interest editing state (for BID_INTEREST type)
  const [modalInterestValue, setModalInterestValue] = useState<string>('');

  // Auto-dismiss messages
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

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


  const fetchPaymentSchedule = async () => {
    setIsPaymentScheduleLoading(true);
    try {
      const response = await api.get(`/share-groups/${id}/payment-schedule`);
      setPaymentScheduleData(response.data.data);
      // Expand all members by default
      const allMemberIds = new Set<number>(response.data.data.members.map((m: PaymentScheduleMember) => m.id));
      setExpandedMembers(allMemberIds);
    } catch (err) {
      console.error('Failed to fetch payment schedule:', err);
    } finally {
      setIsPaymentScheduleLoading(false);
    }
  };

  const openPaymentScheduleModal = () => {
    setShowPaymentScheduleModal(true);
    if (!paymentScheduleData) {
      fetchPaymentSchedule();
    }
  };

  const fetchRoundPayments = async (roundId: number) => {
    setRoundPaymentsLoading(true);
    try {
      const response = await api.get(`/rounds/${roundId}/payments`);
      const data = response.data.data;
      setRoundPaymentsData(data);
      // Initialize local payments state
      const payments: { [key: number]: boolean } = {};
      data.payments.forEach((p: RoundPayment) => {
        if (!p.isWinner) {
          payments[p.groupMemberId] = p.isPaid || false;
        }
      });
      setLocalPayments(payments);
    } catch (err) {
      console.error('Failed to fetch round payments:', err);
    } finally {
      setRoundPaymentsLoading(false);
    }
  };

  const handlePaymentToggle = (groupMemberId: number) => {
    setLocalPayments((prev) => ({
      ...prev,
      [groupMemberId]: !prev[groupMemberId],
    }));
  };

  const handleSaveRoundPayments = async () => {
    if (!selectedRoundForDeduction) return;

    try {
      const payments = Object.entries(localPayments).map(([groupMemberId, isPaid]) => ({
        groupMemberId: parseInt(groupMemberId),
        isPaid,
      }));

      await api.post(`/rounds/${selectedRoundForDeduction.id}/payments`, { payments });
      setMessage('บันทึกการชำระเงินเรียบร้อยแล้ว');
      // Refresh payment data
      fetchRoundPayments(selectedRoundForDeduction.id);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'เกิดข้อผิดพลาด');
    }
  };

  const toggleMemberExpand = (memberId: number) => {
    setExpandedMembers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
  };

  const toggleAllMembers = () => {
    if (paymentScheduleData) {
      if (expandedMembers.size === paymentScheduleData.members.length) {
        setExpandedMembers(new Set());
      } else {
        setExpandedMembers(new Set(paymentScheduleData.members.map(m => m.id)));
      }
    }
  };

  // Calculate default interest for a round based on group type
  const getDefaultInterest = (round: Round): number => {
    if (!group) return 0;
    if (round.roundNumber === 1) return 0; // งวดแรกไม่มีดอก

    switch (group.type) {
      case 'STEP_INTEREST':
        return (group.interestRate || 0) * round.roundNumber;
      case 'FIXED_INTEREST':
        return group.interestRate || 0;
      case 'BID_INTEREST':
      case 'BID_PRINCIPAL':
      case 'BID_PRINCIPAL_FIRST':
        return round.winningBid || 0;
      default:
        return 0;
    }
  };

  // Get display interest (winningBid if set, otherwise calculated)
  const getDisplayInterest = (round: Round): number | null => {
    if (round.roundNumber === 1) return null;
    if (round.winningBid !== null) return round.winningBid;
    return getDefaultInterest(round);
  };

  // Check if round can edit interest (not first round, not BID type unless has winner)
  const canEditInterest = (round: Round): boolean => {
    if (round.roundNumber === 1) return false;
    if (!group) return false;
    // For BID types, can only edit after winner is set
    if (group.type.startsWith('BID_') && !round.winnerId) return false;
    return true;
  };

  // Start editing interest
  const startEditInterest = (round: Round) => {
    const currentValue = round.winningBid ?? getDefaultInterest(round);
    setEditingInterestRoundId(round.id);
    setEditInterestValue(currentValue.toString());
  };

  // Cancel editing
  const cancelEditInterest = () => {
    setEditingInterestRoundId(null);
    setEditInterestValue('');
  };

  // Save interest
  const saveInterest = async (roundId: number) => {
    const value = parseFloat(editInterestValue);
    if (isNaN(value) || value < 0) {
      setError('กรุณากรอกดอกเบี้ยที่ถูกต้อง');
      return;
    }

    setSavingInterest(true);
    try {
      await api.put(`/rounds/${roundId}`, { interest: value });
      // Update local rounds state
      setRounds(prev => prev.map(r =>
        r.id === roundId ? { ...r, winningBid: value } : r
      ));
      setMessage('บันทึกดอกเบี้ยเรียบร้อยแล้ว');
      cancelEditInterest();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSavingInterest(false);
    }
  };

  // Handle keyboard events for interest input
  const handleInterestKeyDown = (e: React.KeyboardEvent, roundId: number) => {
    if (e.key === 'Enter') {
      saveInterest(roundId);
    } else if (e.key === 'Escape') {
      cancelEditInterest();
    }
  };

  const generateShareText = () => {
    if (!paymentScheduleData) return '';

    let text = `📅 ตารางวันที่ต้องชำระ\n`;
    text += `วง: ${paymentScheduleData.groupName}\n`;
    text += `เงินต้น: ${paymentScheduleData.principalAmount.toLocaleString()} บาท/งวด\n\n`;

    paymentScheduleData.rounds.forEach(round => {
      const dateStr = new Date(round.dueDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
      const winner = round.winnerName || 'รอ';
      text += `งวด ${round.roundNumber}: ${dateStr} - ${winner}\n`;
    });

    text += `\n💡 ทุกคนต้องชำระ ${paymentScheduleData.principalAmount.toLocaleString()} บาท ทุกงวด\n`;
    text += `   ยกเว้นงวดที่ตัวเองเปีย`;

    return text;
  };

  const copyToClipboard = () => {
    const text = generateShareText();
    navigator.clipboard.writeText(text).then(() => {
      setMessage('คัดลอกข้อความเรียบร้อยแล้ว');
    });
  };

  const shareToLine = () => {
    const text = encodeURIComponent(generateShareText());
    window.open(`https://line.me/R/msg/text/?${text}`, '_blank');
  };

  const openRoundDeductionModal = async (round: Round) => {
    setSelectedRoundForDeduction(round);
    setError('');
    setRoundModalTab('deductions');
    setRoundPaymentsData(null);
    // Initialize modal interest value for BID_INTEREST type
    setModalInterestValue(round.winningBid?.toString() || '');
    try {
      const response = await api.get(`/deductions/round/${round.id}`);
      const savedDeductions = response.data.data || [];

      const autoItems = buildAutoDeductionItems(round);

      if (savedDeductions.length > 0) {
        const savedMap = new Map(savedDeductions.map((d: { id: number; note?: string; type: string; amount: number }) => [d.note || d.type, d]));
        const mergedItems: { id?: number; name: string; amount: number }[] = [];

        autoItems.forEach(auto => {
          const saved = savedMap.get(auto.name) as { id: number; amount: number } | undefined;
          if (saved) {
            mergedItems.push({ id: saved.id, name: auto.name, amount: saved.amount });
            savedMap.delete(auto.name);
          } else {
            mergedItems.push({ name: auto.name, amount: auto.amount });
          }
        });

        savedMap.forEach((saved) => {
          const s = saved as { id: number; note?: string; type: string; amount: number };
          mergedItems.push({ id: s.id, name: s.note || s.type, amount: s.amount });
        });

        setRoundDeductionItems(mergedItems);
      } else {
        setRoundDeductionItems(autoItems);
      }
      setShowRoundDeductionModal(true);
    } catch {
      const autoItems = buildAutoDeductionItems(round);
      setRoundDeductionItems(autoItems);
      setShowRoundDeductionModal(true);
    }
  };

  const handleRoundModalTabChange = (tab: 'deductions' | 'payments') => {
    setRoundModalTab(tab);
    if (tab === 'payments' && selectedRoundForDeduction && !roundPaymentsData) {
      fetchRoundPayments(selectedRoundForDeduction.id);
    }
  };

  const buildAutoDeductionItems = (round?: Round) => {
    const items: { name: string; amount: number }[] = [];
    const currentRound = round || selectedRoundForDeduction;

    items.push({
      name: 'ค่าดูแลวง',
      amount: group?.managementFee || 0
    });

    let interestAmount = 0;
    let interestNote = 'ดอกเบี้ย';

    if (currentRound) {
      if (currentRound.roundNumber > 1) {
        switch (group?.type) {
          case 'STEP_INTEREST':
            interestAmount = (group.interestRate || 0) * currentRound.roundNumber;
            if (group.interestRate) {
              interestNote = `ดอกเบี้ย (${group.interestRate}x${currentRound.roundNumber})`;
            }
            break;
          case 'FIXED_INTEREST':
            interestAmount = group.interestRate || 0;
            interestNote = 'ดอกเบี้ยคงที่';
            break;
          case 'BID_INTEREST':
          case 'BID_PRINCIPAL':
          case 'BID_PRINCIPAL_FIRST':
            interestAmount = currentRound.winningBid || 0;
            interestNote = 'ดอกประมูล';
            break;
        }
      }
    }

    items.push({ name: interestNote, amount: interestAmount });

    if (group?.deductionTemplates) {
      group.deductionTemplates.forEach((t) => {
        if (t.name !== 'ค่าดูแลวง') {
          items.push({ name: t.name, amount: t.amount });
        }
      });
    }

    return items;
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
      // Save deductions
      await api.post(`/deductions/round/${selectedRoundForDeduction.id}`, {
        deductions: roundDeductionItems.filter(d => d.name && d.amount > 0),
      });

      // For BID_INTEREST type, also save the interest
      if (group?.type === 'BID_INTEREST') {
        const interestValue = parseFloat(modalInterestValue) || 0;
        if (interestValue >= 0) {
          await api.put(`/rounds/${selectedRoundForDeduction.id}`, {
            interest: interestValue,
          });
        }
      }

      setMessage('บันทึกรายการหักรับเรียบร้อยแล้ว');
      setShowRoundDeductionModal(false);
      setSelectedRoundForDeduction(null);
      fetchRounds();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'เกิดข้อผิดพลาด');
    }
  };

  const generateRounds = async () => {
    try {
      await api.post(`/rounds/generate/${id}`);
      setMessage('สร้างตารางงวดเรียบร้อยแล้ว');
      fetchRounds();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'เกิดข้อผิดพลาด');
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
      setMessage('เพิ่มลูกแชร์เรียบร้อยแล้ว');
      setShowAddModal(false);
      resetForm();
      fetchGroup();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'เกิดข้อผิดพลาด');
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
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'เกิดข้อผิดพลาด');
    }
  };

  const handleDeleteMember = async (memberId: number) => {
    if (!confirm('ต้องการลบลูกแชร์นี้?')) return;

    try {
      await api.delete(`/members/${memberId}`);
      setMessage('ลบลูกแชร์เรียบร้อยแล้ว');
      fetchGroup();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'เกิดข้อผิดพลาด');
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
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'เกิดข้อผิดพลาด');
    }
  };

  const getTotalDeductions = () => {
    return group?.deductionTemplates?.reduce((sum, d) => sum + d.amount, 0) || 0;
  };

  const handleOpenGroup = async () => {
    setError('');
    try {
      await api.post(`/share-groups/${id}/open`);
      setMessage('เปิดวงเรียบร้อยแล้ว');
      setShowOpenModal(false);
      fetchGroup();
      fetchRounds();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'เกิดข้อผิดพลาด');
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
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'เกิดข้อผิดพลาด');
    }
  };

  const canOpenGroup = () => {
    return group?.status === 'DRAFT' &&
           group.members.length >= group.maxMembers &&
           rounds.length > 0;
  };

  const getStatusConfig = () => {
    switch (group?.status) {
      case 'DRAFT':
        return { label: 'ร่าง', bg: 'bg-gray-100', text: 'text-gray-600', icon: '📝' };
      case 'OPEN':
        return { label: 'เปิดวง', bg: 'bg-green-100', text: 'text-green-700', icon: '✅' };
      case 'IN_PROGRESS':
        return { label: 'กำลังดำเนินการ', bg: 'bg-yellow-100', text: 'text-yellow-700', icon: '🔄' };
      case 'COMPLETED':
        return { label: 'เสร็จสิ้น', bg: 'bg-blue-100', text: 'text-blue-700', icon: '🎉' };
      case 'CANCELLED':
        return { label: 'ยกเลิก', bg: 'bg-red-100', text: 'text-red-700', icon: '❌' };
      default:
        return { label: '', bg: '', text: '', icon: '' };
    }
  };

  const openWinnerModal = (round: Round) => {
    setSelectedRound(round);

    const availableMembers = group?.members.filter(m => !m.hasWon) || [];
    const hostMember = group?.members.find(m => m.userId === group?.hostId);

    let defaultMemberId = 0;

    if (round.roundNumber === 1 && hostMember) {
      defaultMemberId = hostMember.id;
    } else if (availableMembers.length === 1) {
      defaultMemberId = availableMembers[0].id;
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
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'เกิดข้อผิดพลาด');
    }
  };

  const calculatePayout = () => {
    if (!group) return 0;
    const totalPool = group.principalAmount * group.maxMembers;
    const interest = winnerFormData.interest || 0;
    const totalDeductions = getTotalDeductions();
    return totalPool - interest - totalDeductions;
  };

  const getAvailableMembers = () => {
    return group?.members.filter(m => !m.hasWon) || [];
  };

  const isFirstRound = () => selectedRound?.roundNumber === 1;
  const isLastRound = () => getAvailableMembers().length === 1;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🔍</div>
        <p className="text-gray-500 text-lg">ไม่พบวงแชร์</p>
        <Link to="/share-groups" className="text-blue-600 hover:text-blue-500 mt-4 inline-block">
          กลับไปรายการวงแชร์
        </Link>
      </div>
    );
  }

  const statusConfig = getStatusConfig();
  const completedRounds = rounds.filter(r => r.winnerId).length;
  const progressPercent = rounds.length > 0 ? (completedRounds / rounds.length) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link to="/share-groups" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span>กลับไปรายการวงแชร์</span>
      </Link>

      {/* Toast Messages */}
      {message && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {message}
          </div>
        </div>
      )}

      {error && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className="bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {error}
          </div>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">{group.name}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                {statusConfig.icon} {statusConfig.label}
              </span>
            </div>
            <div className="flex items-center gap-2 text-blue-100">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[group.type]}`}>
                {typeLabels[group.type]}
              </span>
              <span>•</span>
              <span>เริ่ม {new Date(group.startDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
            </div>
          </div>

          {group.status === 'DRAFT' && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowOpenModal(true)}
                disabled={!canOpenGroup()}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  canOpenGroup()
                    ? 'bg-white text-green-600 hover:bg-green-50 shadow-md'
                    : 'bg-white/20 text-white/60 cursor-not-allowed'
                }`}
              >
                เปิดวง
              </button>
              <button
                onClick={() => setShowCancelModal(true)}
                className="px-5 py-2.5 bg-white/20 text-white rounded-lg text-sm font-medium hover:bg-white/30 transition-all"
              >
                ยกเลิกวง
              </button>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {rounds.length > 0 && (
          <div className="mt-6">
            <div className="flex justify-between text-sm text-blue-100 mb-2">
              <span>ความคืบหน้า</span>
              <span>{completedRounds}/{rounds.length} งวด</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-gray-500 text-xs mb-1">เงินต้น</div>
          <div className="text-lg font-bold text-gray-900">{group.principalAmount.toLocaleString()}</div>
          <div className="text-xs text-gray-400">บาท/คน</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-gray-500 text-xs mb-1">ลูกแชร์</div>
          <div className="text-lg font-bold text-gray-900">{group.members.length}/{group.maxMembers}</div>
          <div className="text-xs text-gray-400">คน</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-gray-500 text-xs mb-1">เงินกองกลาง</div>
          <div className="text-lg font-bold text-blue-600">{(group.principalAmount * group.maxMembers).toLocaleString()}</div>
          <div className="text-xs text-gray-400">บาท/งวด</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-gray-500 text-xs mb-1">ค่าดูแลวง</div>
          <div className="text-lg font-bold text-orange-600">{(group.managementFee || 0).toLocaleString()}</div>
          <div className="text-xs text-gray-400">บาท</div>
        </div>
        {(group.type === 'STEP_INTEREST' || group.type === 'FIXED_INTEREST') && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-gray-500 text-xs mb-1">ดอกเบี้ย</div>
            <div className="text-lg font-bold text-purple-600">{(group.interestRate || 0).toLocaleString()}</div>
            <div className="text-xs text-gray-400">บาท{group.type === 'STEP_INTEREST' ? '/งวด' : ''}</div>
          </div>
        )}
        {group.summary && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-gray-500 text-xs mb-1">สถานะสมาชิก</div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-green-600">{group.summary.wonCount}</span>
              <span className="text-gray-400">/</span>
              <span className="text-sm text-gray-500">{group.summary.notWonCount}</span>
            </div>
            <div className="text-xs text-gray-400">เปีย/รอ</div>
          </div>
        )}
      </div>

      {/* Alert for DRAFT */}
      {group.status === 'DRAFT' && !canOpenGroup() && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div className="text-sm text-amber-700">
            {group.members.length < group.maxMembers && (
              <p>ต้องเพิ่มลูกแชร์ให้ครบ {group.maxMembers} คน (ปัจจุบัน {group.members.length} คน)</p>
            )}
            {rounds.length === 0 && (
              <p>ต้องสร้างตารางงวดก่อนเปิดวง</p>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100">
          <nav className="flex items-center">
            <div className="flex flex-1">
              {[
                { key: 'members', label: 'ลูกแชร์', icon: '👥', count: `${group.members.length}/${group.maxMembers}` },
                { key: 'rounds', label: 'งวด', icon: '📅', count: `${completedRounds}/${rounds.length}` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as 'members' | 'rounds')}
                  className={`flex-1 px-6 py-4 text-sm font-medium transition-all relative ${
                    activeTab === tab.key
                      ? 'text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                    {tab.count && (
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        activeTab === tab.key ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </span>
                  {activeTab === tab.key && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                  )}
                </button>
              ))}
            </div>
            {(group.status === 'OPEN' || group.status === 'IN_PROGRESS' || group.status === 'COMPLETED') && (
              <div className="px-4">
                <button
                  onClick={openPaymentScheduleModal}
                  className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <span>📋</span>
                  <span className="hidden sm:inline">ตารางชำระ</span>
                </button>
              </div>
            )}
          </nav>
        </div>

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  <span className="text-gray-600">เปียแล้ว {group.summary?.wonCount || 0}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span className="text-gray-600">ยังไม่เปีย {group.summary?.notWonCount || 0}</span>
                </span>
              </div>
              {group.status === 'DRAFT' && group.members.length < group.maxMembers && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  เพิ่มลูกแชร์
                </button>
              )}
            </div>

            {group.members.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-5xl mb-4">👥</div>
                <p className="text-gray-500">ยังไม่มีลูกแชร์</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {group.members.map((member) => (
                  <div key={member.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
                        member.hasWon ? 'bg-green-500' : 'bg-blue-500'
                      }`}>
                        {member.userId === group.hostId ? '👑' : (member.memberCode?.slice(-1) || member.nickname?.charAt(0) || '?')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{member.nickname}</span>
                          {member.userId === group.hostId && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">ท้าวแชร์</span>
                          )}
                          {member.memberCode && <span className="text-xs text-gray-400">{member.memberCode}</span>}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                          {member.phone && (
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              {member.phone}
                            </span>
                          )}
                          {member.lineId && (
                            <span className="flex items-center gap-1">
                              <span className="text-green-500 font-bold text-xs">LINE</span>
                              {member.lineId}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {member.hasWon ? (
                        <span className="px-3 py-1.5 bg-green-100 text-green-700 text-sm rounded-full font-medium">
                          เปียงวด {member.wonRoundNumber}
                        </span>
                      ) : (
                        <span className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm rounded-full font-medium">
                          ยังไม่เปีย
                        </span>
                      )}
                      <button
                        onClick={() => openEditModal(member)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      {group.status === 'DRAFT' && !member.hasWon && (
                        <button
                          onClick={() => handleDeleteMember(member.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Rounds Tab */}
        {activeTab === 'rounds' && (
          <div className="p-6">
            {rounds.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">📅</div>
                <p className="text-gray-500 mb-4">ยังไม่มีตารางงวด</p>
                {group.status === 'DRAFT' && group.members.length === group.maxMembers && (
                  <button
                    onClick={generateRounds}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    สร้างตารางงวด
                  </button>
                )}
                {group.status === 'DRAFT' && group.members.length < group.maxMembers && (
                  <p className="text-sm text-amber-600 mt-2">
                    ต้องเพิ่มลูกแชร์ให้ครบ {group.maxMembers} คนก่อน
                  </p>
                )}
              </div>
            ) : (
              <>
                {/* Compact Timeline */}
                <div className="mb-8 overflow-x-auto pb-2">
                  <div className="flex items-center gap-1 min-w-max">
                    {rounds.map((round, index) => {
                      const isCompleted = round.status === 'COMPLETED';
                      const isCurrent = !round.winnerId && (index === 0 || rounds[index - 1]?.winnerId);

                      return (
                        <div key={round.id} className="flex items-center">
                          <button
                            onClick={() => !isCompleted && isCurrent && group.status === 'OPEN' && openWinnerModal(round)}
                            disabled={!(!isCompleted && isCurrent && group.status === 'OPEN')}
                            className={`relative group ${!isCompleted && isCurrent && group.status === 'OPEN' ? 'cursor-pointer' : ''}`}
                          >
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                                isCompleted
                                  ? 'bg-green-500 text-white'
                                  : isCurrent
                                  ? 'bg-blue-500 text-white ring-4 ring-blue-200 animate-pulse'
                                  : 'bg-gray-200 text-gray-500'
                              }`}
                            >
                              {isCompleted ? '✓' : round.roundNumber}
                            </div>
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                              <div className="font-medium">งวด {round.roundNumber}</div>
                              {round.winner && <div className="text-gray-300">{round.winner.nickname}</div>}
                              {round.winningBid !== null && round.winningBid > 0 && (
                                <div className="text-green-400">{round.winningBid.toLocaleString()} บาท</div>
                              )}
                              {!round.winnerId && isCurrent && group.status === 'OPEN' && (
                                <div className="text-blue-300">คลิกเพื่อบันทึก</div>
                              )}
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                            </div>
                          </button>
                          {index < rounds.length - 1 && (
                            <div className={`w-6 h-0.5 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Rounds Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">งวด</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">กำหนดชำระ</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ผู้ชนะ</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ดอกเบี้ย</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ได้รับ</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rounds.map((round) => (
                        <tr key={round.id} className={round.winnerId ? '' : 'bg-gray-50/50'}>
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-900">{round.roundNumber}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(round.dueDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </td>
                          <td className="px-4 py-3">
                            {round.status === 'COMPLETED' ? (
                              <span className="px-2.5 py-1 text-xs bg-green-100 text-green-700 rounded-full font-medium">สำเร็จ</span>
                            ) : (
                              <span className="px-2.5 py-1 text-xs bg-gray-100 text-gray-500 rounded-full font-medium">รอ</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">{round.winner?.nickname || '-'}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            {editingInterestRoundId === round.id ? (
                              // Edit mode
                              <div className="flex items-center justify-end gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  value={editInterestValue}
                                  onChange={(e) => setEditInterestValue(e.target.value)}
                                  onKeyDown={(e) => handleInterestKeyDown(e, round.id)}
                                  onBlur={() => cancelEditInterest()}
                                  autoFocus
                                  className="w-20 px-2 py-1 text-right text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => saveInterest(round.id)}
                                  disabled={savingInterest}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                                >
                                  {savingInterest ? (
                                    <span className="text-xs">⏳</span>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>
                              </div>
                            ) : (
                              // Display mode
                              canEditInterest(round) ? (
                                <button
                                  onClick={() => startEditInterest(round)}
                                  className="group inline-flex items-center gap-1 hover:text-blue-600 transition-colors"
                                >
                                  <span>{getDisplayInterest(round)?.toLocaleString() || '-'}</span>
                                  <span className="opacity-0 group-hover:opacity-100 text-gray-400 text-xs transition-opacity">✎</span>
                                </button>
                              ) : (
                                <span>{getDisplayInterest(round)?.toLocaleString() || '-'}</span>
                              )
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                            {round.payoutAmount !== null ? round.payoutAmount.toLocaleString() : '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => openRoundDeductionModal(round)}
                              className="px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-sm transition-colors"
                            >
                              จัดการ
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </>
            )}
          </div>
        )}

      </div>

      {/* Modals */}
      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">เพิ่มลูกแชร์</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div className="text-sm text-gray-500 bg-gray-50 px-4 py-3 rounded-xl">
                รหัสลูกแชร์จะถูกสร้างอัตโนมัติ
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อเล่น *</label>
                <input
                  type="text"
                  required
                  value={formData.nickname}
                  onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="เช่น พี่แดง, น้องเอ"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทร</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="08x-xxx-xxxx"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ไลน์ไอดี</label>
                <input
                  type="text"
                  value={formData.lineId}
                  onChange={(e) => setFormData({ ...formData, lineId: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ที่อยู่</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">แก้ไขลูกแชร์</h2>
              <button onClick={() => { setShowEditModal(false); setEditingMember(null); resetForm(); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleEditMember} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รหัสลูกแชร์</label>
                <div className="px-4 py-3 bg-gray-100 rounded-xl text-gray-700 font-medium">
                  {editingMember?.memberCode}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อเล่น *</label>
                <input
                  type="text"
                  required
                  value={formData.nickname}
                  onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทร</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ไลน์ไอดี</label>
                <input
                  type="text"
                  value={formData.lineId}
                  onChange={(e) => setFormData({ ...formData, lineId: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ที่อยู่</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingMember(null); resetForm(); }}
                  className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">
                บันทึกผู้ชนะ - งวดที่ {selectedRound.roundNumber}
              </h2>
              <button onClick={() => { setShowWinnerModal(false); setSelectedRound(null); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleRecordWinner} className="space-y-4">
              {isFirstRound() && (
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl text-blue-700">
                  <span className="text-xl">👑</span>
                  <span className="text-sm">งวดแรกเป็นสิทธิ์ของท้าวแชร์</span>
                </div>
              )}
              {isLastRound() && (
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl text-green-700">
                  <span className="text-xl">🎉</span>
                  <span className="text-sm">งวดสุดท้าย - ได้รับเงินเต็ม (ไม่หักดอก)</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ผู้ชนะ *</label>
                <select
                  value={winnerFormData.memberId}
                  onChange={(e) => setWinnerFormData({ ...winnerFormData, memberId: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ดอกเบี้ย (บาท)</label>
                <input
                  type="number"
                  min={0}
                  value={winnerFormData.interest}
                  onChange={(e) => setWinnerFormData({ ...winnerFormData, interest: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isFirstRound() || isLastRound()}
                />
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">สรุปรายการหักรับ</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">เงินกองกลาง:</span>
                    <span className="font-medium">{((group?.principalAmount || 0) * (group?.maxMembers || 0)).toLocaleString()} บาท</span>
                  </div>
                  {winnerFormData.interest > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>- ดอกเบี้ย:</span>
                      <span>-{winnerFormData.interest.toLocaleString()} บาท</span>
                    </div>
                  )}
                  {group?.deductionTemplates && group.deductionTemplates.map((d) => (
                    <div key={d.id} className="flex justify-between text-red-600">
                      <span>- {d.name}:</span>
                      <span>-{d.amount.toLocaleString()} บาท</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 flex justify-between font-medium text-green-600">
                    <span>ได้รับจริง:</span>
                    <span>{calculatePayout().toLocaleString()} บาท</span>
                  </div>
                </div>
              </div>

              {isLastRound() && (
                <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-xl text-orange-700">
                  <span className="text-xl">⚠️</span>
                  <span className="text-sm">วงจะปิดหลังยืนยันงวดนี้</span>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowWinnerModal(false); setSelectedRound(null); }}
                  className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">
                {editingDeduction ? 'แก้ไขรายการหักรับ' : 'เพิ่มรายการหักรับ'}
              </h2>
              <button onClick={() => { setShowDeductionModal(false); setEditingDeduction(null); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveDeduction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อรายการ *</label>
                <input
                  type="text"
                  required
                  value={deductionFormData.name}
                  onChange={(e) => setDeductionFormData({ ...deductionFormData, name: e.target.value })}
                  placeholder="เช่น ค่าดูแลวง, หักท้ายท้าว"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนเงิน (บาท) *</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={deductionFormData.amount || ''}
                  onChange={(e) => setDeductionFormData({ ...deductionFormData, amount: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowDeductionModal(false); setEditingDeduction(null); }}
                  className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">ยืนยันการเปิดวง</h2>
              <button onClick={() => setShowOpenModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">วง:</span>
                  <span className="font-medium">{group?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">ลูกแชร์:</span>
                  <span className="font-medium text-green-600">{group?.members.length}/{group?.maxMembers} คน</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">งวดทั้งหมด:</span>
                  <span className="font-medium">{rounds.length} งวด</span>
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-700">
                <p className="font-medium mb-2">หลังเปิดวงแล้ว:</p>
                <ul className="list-disc list-inside space-y-1 text-amber-600">
                  <li>ไม่สามารถแก้ไขข้อมูลวงได้</li>
                  <li>ไม่สามารถเพิ่ม/ลบลูกแชร์ได้</li>
                  <li>ไม่สามารถแก้ไขรายการหักรับได้</li>
                </ul>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowOpenModal(false)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleOpenGroup}
                  className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">ยืนยันการยกเลิกวง</h2>
              <button onClick={() => { setShowCancelModal(false); setCancelReason(''); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-gray-600">
                คุณต้องการยกเลิกวง <strong>"{group?.name}"</strong> หรือไม่?
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เหตุผล (ไม่บังคับ)</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  placeholder="ระบุเหตุผลที่ยกเลิก..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="bg-red-50 rounded-xl p-4 text-sm text-red-700">
                การยกเลิกไม่สามารถย้อนกลับได้
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowCancelModal(false); setCancelReason(''); }}
                  className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  ไม่ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleCancelGroup}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                >
                  ยกเลิกวง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Round Deductions Modal */}
      {showRoundDeductionModal && selectedRoundForDeduction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-scale-in flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">
                  งวดที่ {selectedRoundForDeduction.roundNumber} - {new Date(selectedRoundForDeduction.dueDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                </h2>
                <button onClick={() => { setShowRoundDeductionModal(false); setSelectedRoundForDeduction(null); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleRoundModalTabChange('deductions')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    roundModalTab === 'deductions'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  รายการหักรับ
                </button>
                <button
                  onClick={() => handleRoundModalTabChange('payments')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                    roundModalTab === 'payments'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  การชำระเงิน
                  {roundPaymentsData && (
                    <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                      roundModalTab === 'payments' ? 'bg-white/20' : 'bg-gray-300'
                    }`}>
                      {roundPaymentsData.paidCount}/{roundPaymentsData.totalMembers}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {roundModalTab === 'deductions' ? (
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-xl p-4 text-sm">
                    {selectedRoundForDeduction.winner && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">ผู้ชนะ:</span>
                        <span className="font-medium">{selectedRoundForDeduction.winner.nickname}</span>
                      </div>
                    )}
                  </div>

                  {/* Interest section - editable for BID_INTEREST type */}
                  {group?.type === 'BID_INTEREST' ? (
                    <div className="p-4 bg-yellow-50 rounded-xl">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-yellow-700">ดอกเบี้ย (ประมูล)</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            value={modalInterestValue}
                            onChange={(e) => setModalInterestValue(e.target.value)}
                            placeholder="0"
                            className="w-24 px-3 py-1.5 text-sm text-right border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-white"
                          />
                          <span className="text-sm text-yellow-700">บาท</span>
                        </div>
                      </div>
                    </div>
                  ) : selectedRoundForDeduction.winningBid !== null && selectedRoundForDeduction.winningBid > 0 ? (
                    <div className="flex justify-between items-center p-4 bg-yellow-50 rounded-xl">
                      <span className="text-sm font-medium text-yellow-700">ดอกเบี้ย</span>
                      <span className="text-sm text-red-600 font-bold">
                        {selectedRoundForDeduction.winningBid.toLocaleString()} บาท
                      </span>
                    </div>
                  ) : null}

                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-medium text-gray-700">รายการหักรับ</h3>
                      <button
                        type="button"
                        onClick={handleAddDeductionItem}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        + เพิ่มรายการ
                      </button>
                    </div>
                    <div className="space-y-2">
                      {roundDeductionItems.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleDeductionItemChange(index, 'name', e.target.value)}
                            placeholder="ชื่อรายการ"
                            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="number"
                            min={0}
                            value={item.amount || ''}
                            onChange={(e) => handleDeductionItemChange(index, 'amount', e.target.value)}
                            placeholder="0"
                            className="w-28 px-3 py-2 text-sm border border-gray-200 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-xs text-gray-500">บาท</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDeductionItem(index)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      {roundDeductionItems.length === 0 && (
                        <div className="text-center py-6 text-gray-400 text-sm">
                          ยังไม่มีรายการหักรับ
                        </div>
                      )}
                    </div>
                  </div>

                  {(() => {
                    // Calculate interest based on type
                    const interestAmount = group?.type === 'BID_INTEREST'
                      ? (parseFloat(modalInterestValue) || 0)
                      : (selectedRoundForDeduction.winningBid || 0);
                    const deductionsTotal = roundDeductionItems.reduce((sum, d) => sum + (d.amount || 0), 0);
                    const totalPool = (group?.principalAmount || 0) * (group?.maxMembers || 0);

                    return (
                      <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-600">รวมหักรับ:</span>
                          <span className="font-bold text-red-600">
                            {(interestAmount + deductionsTotal).toLocaleString()} บาท
                          </span>
                        </div>
                        <div className="border-t border-blue-200 pt-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-blue-600">เงินกองกลาง:</span>
                            <span className="font-medium">{totalPool.toLocaleString()} บาท</span>
                          </div>
                          <div className="flex justify-between text-sm mt-2">
                            <span className="text-green-600 font-medium">ผู้ชนะได้รับ:</span>
                            <span className="font-bold text-green-600 text-lg">
                              {(totalPool - interestAmount - deductionsTotal).toLocaleString()} บาท
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="space-y-4">
                  {roundPaymentsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : !roundPaymentsData ? (
                    <div className="text-center py-12 text-gray-500">ไม่สามารถโหลดข้อมูลได้</div>
                  ) : (
                    <>
                      {/* Winner Banner - Shows who receives money this round */}
                      {(() => {
                        const winner = roundPaymentsData.payments.find(p => p.isWinner);
                        if (!winner) return null;

                        const isFirstRound = selectedRoundForDeduction.roundNumber === 1;
                        const totalPool = (group?.principalAmount || 0) * (group?.maxMembers || 0);

                        return (
                          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-4 border border-yellow-200">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center">
                                <span className="text-xl">🎉</span>
                              </div>
                              <div>
                                <div className="font-semibold text-yellow-800">
                                  {isFirstRound ? 'งวดแรก - ท้าวได้รับเงิน' : 'ผู้เปียงวดนี้'}
                                </div>
                                <div className="text-sm text-yellow-700">
                                  {winner.isHost && <span className="mr-1">👑</span>}
                                  {winner.nickname}
                                  {winner.isHost && ' (ท้าว)'}
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 p-3 bg-white/60 rounded-lg">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-yellow-700">ได้รับเงิน:</span>
                                <span className="font-bold text-lg text-green-600">
                                  {totalPool.toLocaleString()} บาท
                                </span>
                              </div>
                              <div className="text-xs text-yellow-600 mt-1">(ไม่ต้องชำระเงินในงวดนี้)</div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Payment Summary */}
                      <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="text-sm text-gray-500">เงินต้น</div>
                            <div className="font-bold text-lg">{roundPaymentsData.principalAmount.toLocaleString()} บาท/คน</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-500">ชำระแล้ว</div>
                            <div className="font-bold text-lg text-green-600">
                              {Object.values(localPayments).filter(Boolean).length}/{roundPaymentsData.totalMembers} คน
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 transition-all duration-300"
                            style={{ width: `${(Object.values(localPayments).filter(Boolean).length / roundPaymentsData.totalMembers) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Payment List - excludes winner (they receive money, don't pay) */}
                      <div className="space-y-2">
                        {roundPaymentsData.payments
                          .filter(payment => !payment.isWinner) // Winner doesn't pay, only receives
                          .map((payment) => {
                            // Host doesn't pay in any round (they collect money)
                            const isHostNonWinner = payment.isHost && !payment.isWinner;

                            return (
                              <div
                                key={payment.groupMemberId}
                                className={`p-4 rounded-xl border transition-all ${
                                  isHostNonWinner
                                    ? 'bg-gray-100 border-gray-200 opacity-60'
                                    : localPayments[payment.groupMemberId]
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-gray-50 border-gray-200'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    {isHostNonWinner ? (
                                      // Host - disabled checkbox
                                      <div className="w-8 h-8 rounded-lg border-2 border-gray-300 bg-gray-200 flex items-center justify-center cursor-not-allowed">
                                        <span className="text-gray-400 text-xs">-</span>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => handlePaymentToggle(payment.groupMemberId)}
                                        className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${
                                          localPayments[payment.groupMemberId]
                                            ? 'bg-green-500 border-green-500 text-white'
                                            : 'border-gray-300 hover:border-gray-400'
                                        }`}
                                      >
                                        {localPayments[payment.groupMemberId] && (
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </button>
                                    )}
                                    <div>
                                      <div className="flex items-center gap-2">
                                        {payment.isHost && <span className="text-xs">👑</span>}
                                        <span className={`font-medium ${isHostNonWinner ? 'text-gray-500' : ''}`}>{payment.nickname}</span>
                                        {payment.memberCode && (
                                          <span className="text-xs text-gray-400">({payment.memberCode})</span>
                                        )}
                                      </div>
                                      {isHostNonWinner ? (
                                        <div className="text-xs text-gray-400 mt-0.5">ท้าว - ไม่ต้องชำระ</div>
                                      ) : payment.paidAt ? (
                                        <div className="text-xs text-green-600 mt-0.5">
                                          ชำระเมื่อ {new Date(payment.paidAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                      ) : (
                                        <div className="text-xs text-gray-400 mt-0.5">ยังไม่ชำระ</div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    {!isHostNonWinner && (
                                      <div className="font-medium">{payment.amount.toLocaleString()} บาท</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowRoundDeductionModal(false); setSelectedRoundForDeduction(null); }}
                  className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  ปิด
                </button>
                <button
                  type="button"
                  onClick={roundModalTab === 'deductions' ? handleSaveRoundDeductions : handleSaveRoundPayments}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                >
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Schedule Modal */}
      {showPaymentScheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-scale-in flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📅</span>
                <h2 className="text-xl font-semibold">ตารางชำระรายบุคคล</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleAllMembers}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {expandedMembers.size === paymentScheduleData?.members.length ? 'ย่อทั้งหมด' : 'ขยายทั้งหมด'}
                </button>
                <button
                  onClick={() => setShowPaymentScheduleModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {isPaymentScheduleLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : !paymentScheduleData ? (
                <div className="text-center py-12 text-gray-500">ไม่สามารถโหลดข้อมูลได้</div>
              ) : (
                <div className="space-y-3">
                  {paymentScheduleData.members.map((member) => (
                    <div key={member.id} className="border border-gray-200 rounded-xl overflow-hidden">
                      {/* Member Header */}
                      <button
                        onClick={() => toggleMemberExpand(member.id)}
                        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{expandedMembers.has(member.id) ? '▼' : '▶'}</span>
                          <div className="flex items-center gap-2">
                            {member.isHost && <span>👑</span>}
                            <span className="font-medium">{member.name}</span>
                            {member.memberCode && (
                              <span className="text-xs text-gray-400">({member.memberCode})</span>
                            )}
                          </div>
                          {member.wonRound && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                              เปียงวด {member.wonRound}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          รวม {member.totalPayment.toLocaleString()} บาท
                        </div>
                      </button>

                      {/* Member Payments Table */}
                      {expandedMembers.has(member.id) && (
                        <div className="p-4 bg-white">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="text-gray-500">
                                <th className="text-left py-1 font-medium">งวด</th>
                                <th className="text-left py-1 font-medium">วันที่</th>
                                <th className="text-right py-1 font-medium">ต้องชำระ</th>
                                <th className="text-center py-1 font-medium">สถานะ</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {member.payments.map((payment) => (
                                <tr key={payment.roundNumber}>
                                  <td className="py-2">{payment.roundNumber}</td>
                                  <td className="py-2 text-gray-500">
                                    {new Date(payment.dueDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                                  </td>
                                  <td className="py-2 text-right">
                                    {payment.status === 'WON' ? (
                                      <span className="text-green-600 font-medium">🎉 เปีย</span>
                                    ) : (
                                      <span>{payment.amount.toLocaleString()}</span>
                                    )}
                                  </td>
                                  <td className="py-2 text-center">
                                    {payment.status === 'WON' && (
                                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">ได้รับเงิน</span>
                                    )}
                                    {payment.status === 'PAID' && (
                                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">ชำระแล้ว</span>
                                    )}
                                    {payment.status === 'PENDING' && (
                                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">⏳ รอชำระ</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm">
                            <span className="text-gray-500">รวมต้องชำระ</span>
                            <span className="font-medium">{member.totalPayment.toLocaleString()} บาท ({paymentScheduleData.totalRounds - 1} งวด)</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  💡 ทุกคนชำระ {paymentScheduleData?.principalAmount.toLocaleString() || 0} บาท/งวด ยกเว้นงวดที่เปีย
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={copyToClipboard}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                  >
                    <span>📋</span>
                    คัดลอก
                  </button>
                  <button
                    onClick={shareToLine}
                    className="px-4 py-2 bg-green-500 text-white hover:bg-green-600 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                  >
                    <span>📤</span>
                    แชร์ LINE
                  </button>
                  <button
                    onClick={() => setShowPaymentScheduleModal(false)}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    ปิด
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS for animations */}
      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes scale-in {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
        .animate-scale-in { animation: scale-in 0.2s ease-out; }
      `}</style>
    </div>
  );
}
