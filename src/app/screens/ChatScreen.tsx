import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Send, Image as ImageIcon, MapPin, DollarSign, CheckCircle2 } from 'lucide-react';
import { mockAlbums } from '../data/mockData';
import VinylImage from '../components/VinylImage';
import { completeActiveTrade, getActiveTrade, getTradeCompletion, saveTradeCompletion } from '../data/tradeState';
import { fetchChatMessages, openChatSocket, sendChatSocketMessage, type ChatSocketEvent, type RealtimeChatMessage } from '../data/chatClient';
import { useUser } from '../context/UserContext';

export default function ChatScreen() {
  const navigate = useNavigate();
  const { chatId = '1' } = useParams();
  const { user } = useUser();
  const [messages, setMessages] = useState<RealtimeChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [socketStatus, setSocketStatus] = useState<'connecting' | 'open' | 'closed' | 'error'>('connecting');
  const [isLoading, setIsLoading] = useState(false);
  const [reviewOpened, setReviewOpened] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const album = mockAlbums.find(item => item.id === chatId) || mockAlbums[0];
  const activeTrade = getActiveTrade(album.id);
  const currentUserId = user?.id || 'buyer1';
  const currentUserName = user?.username || '사용자';
  const [completion, setCompletion] = useState(() => ({
    buyerChecked: false,
    sellerChecked: false,
    ...getTradeCompletion(album.id),
  }));
  const isTradeCompleted = completion.buyerChecked && completion.sellerChecked;

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  };

  const upsertMessage = (message: RealtimeChatMessage) => {
    setMessages(prev => {
      const index = prev.findIndex(item => item.id === message.id);
      if (index < 0) return [...prev, message];
      const next = [...prev];
      next[index] = message;
      return next;
    });
    scrollToBottom();
  };

  useEffect(() => {
    saveTradeCompletion(album.id, {
      ...completion,
      completedAt: isTradeCompleted ? (completion.completedAt || new Date().toISOString()) : completion.completedAt,
    });

    if (isTradeCompleted) {
      completeActiveTrade(album.id);
      if (!reviewOpened) {
        setReviewOpened(true);
        setTimeout(() => navigate(`/transaction/review/${album.id}`), 500);
      }
    }
  }, [album.id, completion, isTradeCompleted, navigate, reviewOpened]);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      setIsLoading(true);
      try {
        const history = await fetchChatMessages(chatId);
        if (!cancelled) {
          setMessages(history);
          scrollToBottom();
        }
      } catch {
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    const connect = () => {
      setSocketStatus('connecting');
      const socket = openChatSocket(chatId, currentUserId);
      socketRef.current = socket;

      socket.onopen = () => setSocketStatus('open');
      socket.onerror = () => setSocketStatus('error');
      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data) as ChatSocketEvent;
        if (payload.type === 'history') {
          setMessages(payload.messages);
          scrollToBottom();
        }
        if (payload.type === 'message') {
          upsertMessage(payload.message);
        }
        if (payload.type === 'error') {
          setSocketStatus('error');
        }
      };
      socket.onclose = () => {
        if (cancelled) return;
        setSocketStatus('closed');
        if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = window.setTimeout(connect, 1500);
      };
    };

    void loadHistory();
    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      socketRef.current?.close();
    };
  }, [chatId, currentUserId]);

  const handleSend = () => {
    const content = inputMessage.trim();
    const socket = socketRef.current;
    if (!content || !socket || socket.readyState !== WebSocket.OPEN) return;
    sendChatSocketMessage(socket, {
      senderId: currentUserId,
      senderName: currentUserName,
      message: content,
    });
    setInputMessage('');
  };

  const connectionLabel = socketStatus === 'open'
    ? '실시간 채팅 연결됨'
    : socketStatus === 'connecting'
      ? '실시간 채팅 연결 중'
      : '연결 끊김, 재시도 중';

  return (
    <div className="size-full bg-white flex flex-col">
      <header className="px-4 py-4 border-b flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full active:bg-gray-100">
          <ArrowLeft size={24} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate">{album.seller.name}</h2>
          <p className={`text-xs ${socketStatus === 'open' ? 'text-green-600' : 'text-gray-500'}`}>{connectionLabel}</p>
        </div>
      </header>

      <div className="bg-gray-50 p-3 border-b">
        <div onClick={() => navigate(`/app/album/${album.id}`)} className="bg-white rounded-lg p-3 flex gap-3 cursor-pointer">
          <VinylImage src={album.images[0]} alt={album.title} className="w-16 h-16 object-cover rounded-lg" />
          <div className="flex-1 min-w-0">
            <p className="text-sm mb-1 truncate">{album.title}</p>
            <p className="text-sm text-gray-600 truncate">{album.artist}</p>
            <p className="text-sm mt-1">{album.price.toLocaleString()}원</p>
          </div>
        </div>
      </div>

      <div className="border-b bg-white p-3">
        <div className="rounded-lg border p-3">
          <div className="flex items-center justify-between mb-3 gap-3">
            <div>
              <p className="text-sm font-medium">거래 완료 확인</p>
              <p className="text-xs text-gray-500">구매자와 판매자가 모두 확인하면 거래가 완료됩니다.</p>
            </div>
            {isTradeCompleted ? (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs flex items-center gap-1">
                <CheckCircle2 size={14} />완료
              </span>
            ) : activeTrade ? (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">거래 중</span>
            ) : (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">대기</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setCompletion({ ...completion, buyerChecked: !completion.buyerChecked })}
              className={`py-2 rounded-lg border text-sm ${completion.buyerChecked ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-gray-200 text-gray-700'}`}
            >
              구매자 확인
            </button>
            <button
              onClick={() => setCompletion({ ...completion, sellerChecked: !completion.sellerChecked })}
              className={`py-2 rounded-lg border text-sm ${completion.sellerChecked ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-gray-200 text-gray-700'}`}
            >
              판매자 확인
            </button>
          </div>
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading && <div className="text-center text-sm text-gray-500 py-6">메시지를 불러오는 중입니다.</div>}
        {!isLoading && messages.length === 0 && (
          <div className="text-center text-sm text-gray-500 py-6">아직 메시지가 없습니다. 첫 메시지를 보내보세요.</div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[76%] ${msg.senderId === currentUserId ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'} px-4 py-2 rounded-lg`}>
              {msg.senderId !== currentUserId && <p className="text-[11px] mb-1 text-gray-500">{msg.senderName}</p>}
              <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
              <p className={`text-xs mt-1 ${msg.senderId === currentUserId ? 'text-blue-100' : 'text-gray-500'}`}>
                {new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t p-3">
        <div className="flex gap-2 mb-3">
          <button className="flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-lg text-sm">
            <ImageIcon size={16} />이미지
          </button>
          <button onClick={() => navigate(`/transaction/offer/${album.id}`)} className="flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-lg text-sm">
            <DollarSign size={16} />가격 제안
          </button>
          <button className="flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-lg text-sm">
            <MapPin size={16} />위치
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="메시지를 입력하세요"
            className="flex-1 min-w-0 px-4 py-3 border rounded-lg"
          />
          <button onClick={handleSend} disabled={!inputMessage.trim() || socketStatus !== 'open'} className="px-4 py-3 bg-blue-600 text-white rounded-lg disabled:bg-gray-300">
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
