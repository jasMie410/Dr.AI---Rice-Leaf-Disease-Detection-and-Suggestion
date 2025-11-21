import { useState, useEffect } from 'react';
import { Message, DiseaseInfo } from '@/types';
import { predictDisease, getWeatherData } from '@/services/api'; // Bỏ getSummary
import * as SessionStorage from '@/utils/sessionStorage';
import { useToast } from '@/hooks/use-toast';

interface UseChatResult {
  messages: Message[];
  isLoading: boolean;
  sessionId: string;
  locationDialogOpen: boolean;
  currentMessageId: string;
  handleSendMessage: (text: string, image: File | null) => Promise<void>;
  handleRequestLocation: (messageId: string) => void;
  handleLocationSubmit: (values: { location: string }) => Promise<void>;
  handleClearChat: () => void;
  setLocationDialogOpen: (open: boolean) => void;
}

export const useChat = (): UseChatResult => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [currentMessageId, setCurrentMessageId] = useState<string>('');
  const { toast } = useToast();

  // Initialize session from localStorage
  useEffect(() => {
    try {
      const currentSession = SessionStorage.getCurrentSession();
      setSessionId(currentSession.id);
      setMessages(currentSession.messages);
    } catch (error) {
      console.error('Error loading session:', error);
      const newSession = SessionStorage.createSession();
      setSessionId(newSession.id);
    }
  }, []);

  const handleSendMessage = async (text: string, image: File | null) => {
    if (!text.trim() && !image) return;

    let imageUrl = '';
    if (image) {
      imageUrl = URL.createObjectURL(image);
    }

    // 1. Hiển thị tin nhắn User
    const userMessage: Message = {
      id: SessionStorage.generateId(),
      role: 'user',
      content: text.trim(),
      ...(imageUrl && { image: imageUrl }),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    SessionStorage.addMessage(sessionId, userMessage);
    setIsLoading(true);

    try {
      // 2. Gọi API (Backend đã gộp cả chẩn đoán + Gemini advice)
      // Sử dụng 'any' để linh hoạt nhận dữ liệu từ backend
      const response: any = await predictDisease({
        text: text.trim() || undefined,
        image: image || undefined
      });

      console.log("🔥 Full API Response:", response);

      // --- TRƯỜNG HỢP A: PHÁT HIỆN BỆNH (Gửi ảnh) ---
      // Kiểm tra các key mà Backend trả về (disease_key, disease_name, hoặc is_disease_found)
      if (response.is_disease_found || response.disease_name || response.disease_key) {
        
        // Map dữ liệu từ Backend vào cấu trúc DiseaseInfo của Frontend
        const info: DiseaseInfo = {
          disease_name: response.disease_name || "Bệnh chưa rõ",
          details: response.details || "Đang cập nhật...",
          treatment: response.treatment || "Đang cập nhật...",
          medications: response.medications || []
        };

        // Nội dung tin nhắn là lời khuyên của AI (message/ai_advice)
        const aiContent = response.message || response.ai_advice || `Đã phát hiện: ${info.disease_name}`;

        const systemMessage: Message = {
          id: SessionStorage.generateId(),
          role: 'system',
          content: aiContent, // Hiển thị lời khuyên Gemini ngay lập tức
          timestamp: Date.now(),
          diseaseInfo: info,  // Kèm thông tin chi tiết để hiện nút bấm/collapsible
          isLocationRequest: true // Hiện nút xin vị trí
        };

        setMessages(prev => [...prev, systemMessage]);
        SessionStorage.addMessage(sessionId, systemMessage);

      } 
      // --- TRƯỜNG HỢP B: CHAT TEXT THƯỜNG (Hỏi đáp tiếp theo) ---
      else if (response.message) {
        const textResponseMessage: Message = {
          id: SessionStorage.generateId(),
          role: 'system',
          content: response.message,
          timestamp: Date.now()
        };

        setMessages(prev => [...prev, textResponseMessage]);
        SessionStorage.addMessage(sessionId, textResponseMessage);
      }
      
    } catch (error) {
      console.error('Error getting prediction:', error);
      toast({
        title: "Lỗi kết nối",
        description: "Không thể nhận phản hồi từ Leaf Whisper. Vui lòng thử lại.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestLocation = (messageId: string) => {
    setCurrentMessageId(messageId);
    setLocationDialogOpen(true);
  };

  const handleLocationSubmit = async (values: { location: string }) => {
    setLocationDialogOpen(false);
    
    if (!values.location.trim()) return;
    
    const userLocationMessage: Message = {
      id: SessionStorage.generateId(),
      role: 'user',
      content: `Vị trí của tôi: ${values.location}`,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userLocationMessage]);
    SessionStorage.addMessage(sessionId, userLocationMessage);
    setIsLoading(true);

    try {
      const weatherData = await getWeatherData(values.location);
      
      const weatherMessage: Message = {
        id: SessionStorage.generateId(),
        role: 'system',
        content: weatherData.message || `Đã nhận vị trí: ${values.location}`,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, weatherMessage]);
      SessionStorage.addMessage(sessionId, weatherMessage);

      toast({
        title: "Thông tin vị trí",
        description: `Đã cập nhật: ${values.location}`,
      });
    } catch (error) {
      console.error('Error getting weather data:', error);
      toast({
        title: "Lỗi",
        description: "Không thể lấy thông tin thời tiết.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    const newSession = SessionStorage.createSession();
    setSessionId(newSession.id);
    setMessages([]);
    toast({
      title: "Đã xóa cuộc trò chuyện",
      description: "Bắt đầu phiên mới",
    });
  };

  return {
    messages,
    isLoading,
    sessionId,
    locationDialogOpen,
    currentMessageId,
    handleSendMessage,
    handleRequestLocation,
    handleLocationSubmit,
    handleClearChat,
    setLocationDialogOpen
  };
};