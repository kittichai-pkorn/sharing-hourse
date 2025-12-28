import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';

interface FormData {
  // Step 1
  name: string;
  type: string;
  // Step 2
  maxMembers: number;
  principalAmount: number;
  cycleType: string;
  cycleDays: number;
  startDate: string;
  managementFee: number | null;
  interestRate: number | null;
  paymentPerRound: number | null; // ส่งต่องวด - for FIXED_INTEREST and BID_INTEREST
  // Tail Deduction
  tailDeductionRounds: number | null; // จำนวนงวดท้ายที่จะหัก
  // Note
  note: string;
}

const typeLabels: Record<string, { label: string; description: string }> = {
  STEP_INTEREST: { label: 'ขั้นบันได', description: 'ลูกแชร์แต่ละคนมียอดส่งคงที่ต่างกัน' },
  BID_INTEREST: { label: 'บิทดอกตาม', description: 'ประมูลดอก คนใส่มากสุดชนะ' },
  FIXED_INTEREST: { label: 'ดอกตาม', description: 'ดอกเบี้ยคงที่ + จับฉลาก' },
  BID_PRINCIPAL: { label: 'บิทลดต้น (หักดอกท้าย)', description: 'ประมูล + ลดเงินต้นงวดถัดไป' },
  BID_PRINCIPAL_FIRST: { label: 'บิทลดต้น (หักดอกหน้า)', description: 'ประมูล + ลดเงินต้นทันที' },
};

const cycleTypeLabels: Record<string, string> = {
  DAILY: 'รายวัน',
  WEEKLY: 'รายสัปดาห์',
  MONTHLY: 'รายเดือน',
};

export default function CreateShareGroupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<FormData>({
    name: '',
    type: 'STEP_INTEREST',
    maxMembers: 5,
    principalAmount: 1000,
    cycleType: 'MONTHLY',
    cycleDays: 0,
    startDate: new Date().toISOString().split('T')[0],
    managementFee: null,
    interestRate: null,
    paymentPerRound: null,
    tailDeductionRounds: null,
    note: '',
  });

  const validateStep = (currentStep: number): boolean => {
    setError('');
    switch (currentStep) {
      case 1:
        if (!formData.name.trim()) {
          setError('กรุณากรอกชื่อวง');
          return false;
        }
        return true;
      case 2:
        if (formData.maxMembers < 2) {
          setError('ต้องมีสมาชิกอย่างน้อย 2 คน');
          return false;
        }
        if (formData.principalAmount < 100) {
          setError('เงินต้นต้องไม่น้อยกว่า 100 บาท');
          return false;
        }
        // FIXED_INTEREST requires interestRate
        if (formData.type === 'FIXED_INTEREST' && !formData.interestRate) {
          setError('กรุณากรอกดอกเบี้ย');
          return false;
        }
        // FIXED_INTEREST and BID_INTEREST require paymentPerRound
        if ((formData.type === 'FIXED_INTEREST' || formData.type === 'BID_INTEREST') && !formData.paymentPerRound) {
          setError('กรุณากรอกยอดส่งต่องวด');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const response = await api.post('/share-groups', {
        name: formData.name,
        type: formData.type,
        maxMembers: formData.maxMembers,
        principalAmount: formData.principalAmount,
        cycleType: formData.cycleType,
        cycleDays: formData.cycleDays,
        startDate: formData.startDate,
        managementFee: formData.managementFee,
        interestRate: formData.interestRate,
        paymentPerRound: formData.paymentPerRound,
        tailDeductionRounds: formData.tailDeductionRounds,
        note: formData.note || null,
      });

      navigate(`/share-groups/${response.data.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">สร้างวงแชร์ใหม่</h1>
      </div>

      {/* Stepper - 3 steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {['ข้อมูลพื้นฐาน', 'ตั้งค่าวง', 'ตรวจสอบ'].map((label, index) => (
            <div key={index} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step > index + 1
                    ? 'bg-green-500 text-white'
                    : step === index + 1
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400'
                }`}
              >
                {step > index + 1 ? '✓' : index + 1}
              </div>
              <span className={`ml-2 text-sm hidden sm:block ${step === index + 1 ? 'font-medium text-gray-100' : 'text-gray-400'}`}>
                {label}
              </span>
              {index < 2 && <div className={`w-16 h-0.5 mx-2 ${step > index + 1 ? 'bg-green-500' : 'bg-gray-700'}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-900/50 border border-red-700 text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Step Content */}
      <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300">ชื่อวงแชร์ *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="เช่น วงแชร์พนักงาน มกราคม 2568"
                className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300">รูปแบบวงแชร์ *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(typeLabels).map(([value, { label }]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-400">
                {typeLabels[formData.type]?.description}
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Settings */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">จำนวนสมาชิก *</label>
                <input
                  type="number"
                  min={2}
                  value={formData.maxMembers}
                  onChange={(e) => setFormData({ ...formData, maxMembers: parseInt(e.target.value) || 0 })}
                  className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">เงินต้นต่องวด (บาท) *</label>
                <input
                  type="number"
                  min={100}
                  value={formData.principalAmount}
                  onChange={(e) => setFormData({ ...formData, principalAmount: parseInt(e.target.value) || 0 })}
                  className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300">รอบการชำระ *</label>
              <div className="mt-2 flex gap-4">
                {Object.entries(cycleTypeLabels).map(([value, label]) => (
                  <label key={value} className="flex items-center text-gray-300">
                    <input
                      type="radio"
                      name="cycleType"
                      value={value}
                      checked={formData.cycleType === value}
                      onChange={(e) => setFormData({ ...formData, cycleType: e.target.value, cycleDays: e.target.value === 'DAILY' ? 1 : 0 })}
                      className="mr-2"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {formData.cycleType === 'DAILY' && (
              <div>
                <label className="block text-sm font-medium text-gray-300">ระยะห่างงวด (วัน) *</label>
                <input
                  type="number"
                  min={1}
                  value={formData.cycleDays || 1}
                  onChange={(e) => setFormData({ ...formData, cycleDays: parseInt(e.target.value) || 1 })}
                  className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-sm text-gray-400">
                  เช่น ระบุ 3 = ทุก 3 วัน (วันที่ 1, 4, 7...)
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300">วันที่เริ่มต้น *</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* ส่งต่องวด - required for FIXED_INTEREST and BID_INTEREST */}
            {(formData.type === 'FIXED_INTEREST' || formData.type === 'BID_INTEREST') && (
              <div>
                <label className="block text-sm font-medium text-gray-300">ส่งต่องวด (บาท) *</label>
                <input
                  type="number"
                  min={1}
                  value={formData.paymentPerRound || ''}
                  onChange={(e) => setFormData({ ...formData, paymentPerRound: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="ยอดที่ทุกคนส่งทุกงวด"
                  className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">ค่าดูแลวง (บาท)</label>
                <input
                  type="number"
                  min={0}
                  value={formData.managementFee || ''}
                  onChange={(e) => setFormData({ ...formData, managementFee: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="ไม่บังคับ"
                  className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {/* ดอกเบี้ย - required only for FIXED_INTEREST */}
              {formData.type === 'FIXED_INTEREST' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300">ดอกเบี้ย (บาท) *</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.interestRate || ''}
                    onChange={(e) => setFormData({ ...formData, interestRate: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="ดอกเบี้ยคงที่ต่องวด"
                    className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            {/* Tail Deduction Section */}
            <div className="border-t border-gray-700 pt-4 mt-4">
              <h4 className="text-sm font-medium text-gray-300 mb-3">หักคำท้าย (ค่าตอบแทนท้าว)</h4>
              <div>
                <label className="block text-sm font-medium text-gray-300">จำนวนงวดท้าย</label>
                <input
                  type="number"
                  min={0}
                  max={formData.maxMembers}
                  value={formData.tailDeductionRounds || ''}
                  onChange={(e) => setFormData({ ...formData, tailDeductionRounds: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="เช่น 3 = หัก 3 งวดสุดท้าย"
                  className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {formData.tailDeductionRounds && formData.tailDeductionRounds > 0 && (
                  <p className="mt-2 text-sm text-gray-400">
                    หักจากงวด {formData.maxMembers - formData.tailDeductionRounds + 1} ถึง {formData.maxMembers}
                  </p>
                )}
              </div>
            </div>

            {/* Note Section */}
            <div className="border-t border-gray-700 pt-4 mt-4">
              <label className="block text-sm font-medium text-gray-300">หมายเหตุ</label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                placeholder="บันทึกเพิ่มเติมเกี่ยวกับวงแชร์ (ไม่บังคับ)"
                rows={3}
                className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-100">ตรวจสอบข้อมูล</h3>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">ชื่อวง:</span>
                <span className="ml-2 font-medium text-gray-100">{formData.name}</span>
              </div>
              <div>
                <span className="text-gray-400">รูปแบบ:</span>
                <span className="ml-2 font-medium text-gray-100">{typeLabels[formData.type]?.label}</span>
              </div>
              <div>
                <span className="text-gray-400">สมาชิก:</span>
                <span className="ml-2 font-medium text-gray-100">{formData.maxMembers} คน</span>
              </div>
              <div>
                <span className="text-gray-400">เงินต้น:</span>
                <span className="ml-2 font-medium text-gray-100">{formData.principalAmount.toLocaleString()} บาท</span>
              </div>
              <div>
                <span className="text-gray-400">รอบชำระ:</span>
                <span className="ml-2 font-medium text-gray-100">
                  {formData.cycleType === 'DAILY'
                    ? `ทุก ${formData.cycleDays} วัน`
                    : cycleTypeLabels[formData.cycleType]}
                </span>
              </div>
              {formData.paymentPerRound && (
                <div>
                  <span className="text-gray-400">ส่งต่องวด:</span>
                  <span className="ml-2 font-medium text-gray-100">{formData.paymentPerRound.toLocaleString()} บาท</span>
                </div>
              )}
              {formData.managementFee && (
                <div>
                  <span className="text-gray-400">ค่าดูแลวง:</span>
                  <span className="ml-2 font-medium text-gray-100">{formData.managementFee.toLocaleString()} บาท</span>
                </div>
              )}
              {formData.interestRate && (
                <div>
                  <span className="text-gray-400">ดอกเบี้ย:</span>
                  <span className="ml-2 font-medium text-gray-100">{formData.interestRate.toLocaleString()} บาท</span>
                </div>
              )}
              {formData.tailDeductionRounds && formData.tailDeductionRounds > 0 && (
                <div className="col-span-2">
                  <span className="text-gray-400">หักคำท้าย:</span>
                  <span className="ml-2 font-medium text-gray-100">
                    {formData.tailDeductionRounds} งวดท้าย (งวด {formData.maxMembers - formData.tailDeductionRounds + 1} - {formData.maxMembers})
                  </span>
                </div>
              )}
              {formData.note && (
                <div className="col-span-2">
                  <span className="text-gray-400">หมายเหตุ:</span>
                  <span className="ml-2 font-medium text-gray-100">{formData.note}</span>
                </div>
              )}
            </div>

            <div className="mt-4 bg-yellow-900/50 border border-yellow-700 rounded-md p-3">
              <p className="text-sm text-yellow-400">
                หลังบันทึกแล้วจะแก้ไขบางข้อมูลไม่ได้
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 flex justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={prevStep}
              className="px-4 py-2 border border-gray-600 rounded-md text-gray-300 hover:bg-gray-700"
            >
              ก่อนหน้า
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/share-groups')}
              className="px-4 py-2 border border-gray-600 rounded-md text-gray-300 hover:bg-gray-700"
            >
              ยกเลิก
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={nextStep}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              ถัดไป
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
