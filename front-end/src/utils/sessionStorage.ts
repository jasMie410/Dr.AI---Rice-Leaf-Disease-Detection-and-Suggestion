import { ChatSession, Message } from '@/types';

const STORAGE_KEY = 'leaf-whisper-sessions';

// Generate a unique ID
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// Get all chat sessions
export const getSessions = (): ChatSession[] => {
  try {
    const sessionsJSON = localStorage.getItem(STORAGE_KEY);
    return sessionsJSON ? JSON.parse(sessionsJSON) : [];
  } catch (error) {
    console.error('Error retrieving sessions from localStorage:', error);
    return [];
  }
};

// Get a specific session by ID
export const getSession = (id: string): ChatSession | null => {
  const sessions = getSessions();
  return sessions.find(session => session.id === id) || null;
};

// --- SỬA ĐỔI QUAN TRỌNG ---
// Get the current/latest session
// Logic cũ: Luôn lấy phiên cũ.
// Logic mới: Vẫn lấy phiên cũ để resume, NHƯNG bạn cần dùng createSession() khi muốn tạo mới
export const getCurrentSession = (): ChatSession => {
  const sessions = getSessions();
  if (sessions.length > 0) {
    // Sort by updatedAt in descending order (Lấy cái mới nhất vừa tương tác)
    const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
    return sortedSessions[0];
  }
  
  // Nếu không có gì thì tạo mới
  return createSession();
};

// Create a new chat session (Dùng hàm này khi user bấm nút "New Chat")
export const createSession = (): ChatSession => {
  const newSession: ChatSession = {
    id: generateId(),
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(), // Đảm bảo timestamp mới nhất để getCurrentSession lấy đúng cái này
  };
  
  saveSession(newSession);
  return newSession;
};

// --- TÍNH NĂNG MỚI: XOÁ PHIÊN CŨ ---
// Xoá một phiên cụ thể (Giúp bạn xoá dữ liệu phiên trước)
export const deleteSession = (sessionId: string): void => {
  const sessions = getSessions();
  const newSessions = sessions.filter(session => session.id !== sessionId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newSessions));
};

// --- TÍNH NĂNG MỚI: LÀM SẠCH TIN NHẮN ---
// Giữ nguyên ID phiên nhưng xoá hết tin nhắn bên trong
export const clearSessionMessages = (sessionId: string): void => {
  const session = getSession(sessionId);
  if (session) {
    session.messages = [];
    session.updatedAt = Date.now();
    saveSession(session);
  }
};

// Save a chat session
export const saveSession = (session: ChatSession): void => {
  try {
    const sessions = getSessions();
    const existingIndex = sessions.findIndex(s => s.id === session.id);
    
    session.updatedAt = Date.now();
    
    if (existingIndex !== -1) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error('Error saving session to localStorage:', error);
  }
};

// Add a message to a session
export const addMessage = (sessionId: string, message: Message): void => {
  const session = getSession(sessionId);
  if (session) {
    session.messages.push(message);
    session.updatedAt = Date.now();
    saveSession(session);
  }
};

// Update a message in a session
export const updateMessage = (sessionId: string, updatedMessage: Message): void => {
  const session = getSession(sessionId);
  if (session) {
    const messageIndex = session.messages.findIndex(msg => msg.id === updatedMessage.id);
    if (messageIndex !== -1) {
      session.messages[messageIndex] = updatedMessage;
      session.updatedAt = Date.now();
      saveSession(session);
    }
  }
};

// Remove a message from a session
export const removeMessage = (sessionId: string, messageId: string): void => {
  const session = getSession(sessionId);
  if (session) {
    session.messages = session.messages.filter(msg => msg.id !== messageId);
    session.updatedAt = Date.now();
    saveSession(session);
  }
};

// Clear all sessions (Xoá sạch toàn bộ dữ liệu App)
export const clearAllSessions = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};
