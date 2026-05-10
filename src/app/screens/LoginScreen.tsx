import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Mail } from 'lucide-react';
import { useUser } from '../context/UserContext';

export default function LoginScreen() {
  const navigate = useNavigate();
  const { login } = useUser();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    rememberMe: false,
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    login({
      id: '1',
      username: formData.username,
      email: 'user@example.com',
      phone: '010-1234-5678',
      rating: 4.8,
      transactionCount: 24,
      genres: ['재즈', '락/팝'],
    });
    navigate('/app');
  };

  const handleGoogleLogin = () => {
    login({
      id: '1',
      username: 'Google User',
      email: 'google@example.com',
      phone: '010-1234-5678',
      rating: 4.8,
      transactionCount: 24,
      genres: ['재즈', '락/팝'],
    });
    navigate('/app');
  };

  return (
    <div className="size-full bg-white flex flex-col">
      <header className="px-4 py-4 flex items-center border-b">
        <button onClick={() => navigate('/')} className="p-2">
          <ArrowLeft size={24} />
        </button>
      </header>

      <div className="flex-1 px-6 py-8 overflow-y-auto">
        <h1 className="text-3xl mb-2">로그인</h1>
        <p className="text-gray-600 mb-8">Vinyl-Check에 오신 것을 환영합니다</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm mb-2">아이디 또는 이메일</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full border rounded-lg px-4 py-3"
              placeholder="아이디 또는 이메일 입력"
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
              placeholder="비밀번호 입력"
              required
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="rememberMe"
              checked={formData.rememberMe}
              onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
              className="mr-2"
            />
            <label htmlFor="rememberMe" className="text-sm">로그인 유지</label>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg"
          >
            로그인
          </button>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full border border-gray-300 py-3 rounded-lg flex items-center justify-center gap-2"
          >
            <Mail size={20} />
            Google로 로그인
          </button>
        </form>

        <div className="flex justify-between mt-6 text-sm">
          <button className="text-gray-600">아이디 찾기</button>
          <button className="text-gray-600">비밀번호 찾기</button>
        </div>

        <div className="mt-8 text-center">
          <span className="text-gray-600">계정이 없으신가요? </span>
          <button
            onClick={() => navigate('/auth/signup')}
            className="text-blue-600"
          >
            회원가입
          </button>
        </div>
      </div>
    </div>
  );
}
