import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Send } from 'lucide-react';

interface Comment {
  id: string;
  userName: string;
  content: string;
  timestamp: string;
}

export default function CommentsScreen() {
  const navigate = useNavigate();
  const { albumId } = useParams();
  const [comments, setComments] = useState<Comment[]>([
    {
      id: '1',
      userName: 'LP애호가',
      content: '음반 상태가 정말 좋네요! 구매 고민 중입니다.',
      timestamp: '2026-04-19T10:30:00',
    },
    {
      id: '2',
      userName: '재즈러버',
      content: '이 판본 찾고 있었는데 감사합니다. 혹시 직거래 가능할까요?',
      timestamp: '2026-04-18T15:20:00',
    },
  ]);
  const [newComment, setNewComment] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      setComments([
        {
          id: String(comments.length + 1),
          userName: '나',
          content: newComment,
          timestamp: new Date().toISOString(),
        },
        ...comments,
      ]);
      setNewComment('');
    }
  };

  return (
    <div className="size-full bg-white flex flex-col">
      <header className="px-4 py-4 flex items-center border-b">
        <button onClick={() => navigate(-1)} className="p-2">
          <ArrowLeft size={24} />
        </button>
        <h1 className="ml-4 text-lg">상품 질문</h1>
        <span className="ml-2 text-sm text-gray-500">({comments.length})</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        {comments.map(comment => (
          <div key={comment.id} className="px-4 py-4 border-b">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm">
                {comment.userName[0]}
              </div>
              <span>{comment.userName}</span>
              <span className="text-xs text-gray-400">
                {new Date(comment.timestamp).toLocaleDateString('ko-KR')}
              </span>
            </div>
            <p className="text-sm pl-10">{comment.content}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="판매자에게 질문을 남겨보세요"
            className="flex-1 px-4 py-3 border rounded-lg"
          />
          <button
            type="submit"
            disabled={!newComment.trim()}
            className="px-4 py-3 bg-blue-600 text-white rounded-lg disabled:bg-gray-300"
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
}
