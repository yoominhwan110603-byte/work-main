import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function SignupScreen() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'phone' | 'info'>('phone');
  const [formData, setFormData] = useState({
    phone: '',
    verificationCode: '',
    username: '',
    email: '',
    password: '',
    passwordConfirm: '',
    agreeTerms: false,
  });
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [usernameChecked, setUsernameChecked] = useState(false);

  const handleSendCode = () => {
    setCodeSent(true);
  };

  const handleVerifyCode = () => {
    setPhoneVerified(true);
    setTimeout(() => setStep('info'), 500);
  };

  const handleCheckUsername = () => {
    setUsernameChecked(true);
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/auth/preference');
  };

  if (step === 'phone') {
    return (
      <div className="size-full bg-white flex flex-col">
        <header className="px-4 py-4 flex items-center border-b">
          <button onClick={() => navigate('/auth/login')} className="p-2">
            <ArrowLeft size={24} />
          </button>
          <h2 className="ml-4">전화번호 인증</h2>
        </header>

        <div className="flex-1 px-6 py-8">
          <h1 className="text-2xl mb-2">전화번호를 인증해주세요</h1>
          <p className="text-gray-600 mb-8">안전한 거래를 위해 본인 인증이 필요합니다</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-2">전화번호</label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="flex-1 border rounded-lg px-4 py-3"
                  placeholder="010-0000-0000"
                />
                <button
                  onClick={handleSendCode}
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg whitespace-nowrap"
                >
                  {codeSent ? '재전송' : '인증요청'}
                </button>
              </div>
            </div>

            {codeSent && (
              <div>
                <label className="block text-sm mb-2">인증번호</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.verificationCode}
                    onChange={(e) => setFormData({ ...formData, verificationCode: e.target.value })}
                    className="flex-1 border rounded-lg px-4 py-3"
                    placeholder="6자리 인증번호"
                    maxLength={6}
                  />
                  <button
                    onClick={handleVerifyCode}
                    disabled={formData.verificationCode.length !== 6}
                    className="px-4 py-3 bg-blue-600 text-white rounded-lg whitespace-nowrap disabled:bg-gray-300"
                  >
                    확인
                  </button>
                </div>
              </div>
            )}

            {phoneVerified && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 size={20} />
                <span>인증이 완료되었습니다</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="size-full bg-white flex flex-col">
      <header className="px-4 py-4 flex items-center border-b">
        <button onClick={() => setStep('phone')} className="p-2">
          <ArrowLeft size={24} />
        </button>
        <h2 className="ml-4">회원가입</h2>
      </header>

      <div className="flex-1 px-6 py-8 overflow-y-auto">
        <h1 className="text-2xl mb-2">계정 정보를 입력해주세요</h1>
        <p className="text-gray-600 mb-8">Vinyl-Check 회원이 되어보세요</p>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm mb-2">아이디</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.username}
                onChange={(e) => {
                  setFormData({ ...formData, username: e.target.value });
                  setUsernameChecked(false);
                }}
                className="flex-1 border rounded-lg px-4 py-3"
                placeholder="아이디 입력"
                required
              />
              <button
                type="button"
                onClick={handleCheckUsername}
                className="px-4 py-3 border rounded-lg whitespace-nowrap"
              >
                중복확인
              </button>
            </div>
            {usernameChecked && (
              <p className="text-sm text-green-600 mt-1">사용 가능한 아이디입니다</p>
            )}
          </div>

          <div>
            <label className="block text-sm mb-2">이메일</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full border rounded-lg px-4 py-3"
              placeholder="example@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-2">비밀번호</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full border rounded-lg px-4 py-3"
              placeholder="8자 이상 입력"
              minLength={8}
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-2">비밀번호 확인</label>
            <input
              type="password"
              value={formData.passwordConfirm}
              onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
              className="w-full border rounded-lg px-4 py-3"
              placeholder="비밀번호 재입력"
              required
            />
            {formData.password && formData.passwordConfirm && formData.password !== formData.passwordConfirm && (
              <p className="text-sm text-red-600 mt-1">비밀번호가 일치하지 않습니다</p>
            )}
          </div>

          <div className="flex items-start gap-2 py-4">
            <input
              type="checkbox"
              id="agreeTerms"
              checked={formData.agreeTerms}
              onChange={(e) => setFormData({ ...formData, agreeTerms: e.target.checked })}
              className="mt-1"
              required
            />
            <label htmlFor="agreeTerms" className="text-sm">
              <span className="text-blue-600">이용약관</span> 및 <span className="text-blue-600">개인정보처리방침</span>에 동의합니다
            </label>
          </div>

          <button
            type="submit"
            disabled={!usernameChecked || !formData.agreeTerms || formData.password !== formData.passwordConfirm}
            className="w-full bg-blue-600 text-white py-3 rounded-lg disabled:bg-gray-300"
          >
            회원가입
          </button>
        </form>
      </div>
    </div>
  );
}
