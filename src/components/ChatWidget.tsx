import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, X, Smile, MessageCircle, Mic } from 'lucide-react';
import { fetchWidgetConfig, createThread, sendMessage, getApiBaseUrl, type WidgetConfig } from '../services/api';
import { joinThread, onNewMessage, getSocket, type SocketMessage } from '../services/socket';

interface Message {
  id: string;
  content: string;
  role: 'customer' | 'team';
  createdAt: string;
}

// Theme defaults matching the CRM
const THEME_DEFAULTS = {
  light: {
    headerColor: '#eff6ff',
    headerTextColor: '#172554',
    sendBgColor: '#3b82f6',
    sendTextColor: '#ffffff',
    receiveBgColor: '#f3f4f6',
    receiveTextColor: '#111827',
    chatBgColor: '#ffffff',
    inputBgColor: '#ffffff',
    inputTextColor: '#1f2937',
    inputBorderColor: '#d1d5db',
    containerBgColor: '#f3f4f6',
  },
  dark: {
    headerColor: '#172554',
    headerTextColor: '#ffffff',
    sendBgColor: '#3b82f6',
    sendTextColor: '#ffffff',
    receiveBgColor: '#374151',
    receiveTextColor: '#e5e7eb',
    chatBgColor: '#1f2937',
    inputBgColor: '#374151',
    inputTextColor: '#ffffff',
    inputBorderColor: '#4b5563',
    containerBgColor: '#111827',
  },
};

const DEFAULT_BOT_IMAGE = '/bot.jpg';

interface ChatWidgetProps {
  widgetId: string;
  /** If true, renders as full page instead of floating widget */
  fullPage?: boolean;
}

export default function ChatWidget({ widgetId, fullPage = false }: ChatWidgetProps) {
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [isOpen, setIsOpen] = useState(fullPage);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showContactForm, setShowContactForm] = useState(true);
  const [contactForm, setContactForm] = useState({ email: '', phone: '' });
  const [submittingContact, setSubmittingContact] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<{name?: string; email?: string; phone?: string} | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const socketCleanupRef = useRef<(() => void) | null>(null);
  const inactivityTimeoutRef = useRef<any>(null);

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  // Check speech support
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      setSpeechSupported(true);
    }
  }, []);

  // Inactivity timeout
  useEffect(() => {
    if (!threadId || showContactForm) return;

    const resetTimeout = () => {
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
      inactivityTimeoutRef.current = setTimeout(() => {
        handleDisconnect();
      }, 2 * 60 * 1000); // 2 minutes
    };

    resetTimeout();
    return () => {
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
    };
  }, [threadId, showContactForm]);

  // Update activity on user actions
  const updateActivity = useCallback(() => {
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
      inactivityTimeoutRef.current = setTimeout(() => {
        handleDisconnect();
      }, 2 * 60 * 1000);
    }
  }, []);

  // Load widget config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        setIsLoading(true);
        const data = await fetchWidgetConfig(widgetId);
        setConfig(data);
        setError(null);
      } catch (err) {
        console.error('Failed to load widget config:', err);
        setError('Failed to load chatbot configuration');
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, [widgetId]);

  // Initialize thread and socket after contact form is submitted
  useEffect(() => {
    if (!config || showContactForm) return;

    const initThread = async () => {
      try {
        // Always create a new thread for each visitor (no localStorage reuse)
        const { threadId: newThreadId, customerId } = await createThread({
          companyId: config.companyId,
          agentId: config.agentId,
          name: customerInfo?.email || 'Website Visitor', // Use email as name
          email: customerInfo?.email,
          phone: customerInfo?.phone,
        });

        setThreadId(newThreadId);
      } catch (err) {
        console.error('Failed to initialize thread:', err);
        setError('Failed to connect to chatbot');
      }
    };

    initThread();
  }, [config, showContactForm, customerInfo]);

  // Join socket room when thread is ready
  useEffect(() => {
    if (!threadId) return;

    // Initialize socket
    getSocket();
    joinThread(threadId);

    // Listen for new messages (bot responses)
    const cleanup = onNewMessage((msg: SocketMessage) => {
      if (msg.threadId !== threadId) return;

      // Only add bot messages received via socket
      if (msg.role === 'team') {
        setMessages(prev => [...prev, {
          id: msg.id,
          content: msg.content,
          role: 'team',
          createdAt: msg.createdAt,
        }]);
      }
      setIsTyping(false);
    });

    // Handle reconnection
    const handleReconnect = () => {
      if (threadId) joinThread(threadId);
    };
    const socket = getSocket();
    socket.on('connect', handleReconnect);

    return () => {
      cleanup();
      socket.off('connect', handleReconnect);
    };
  }, [threadId, scrollToBottom]);

  // Add initial message when chat opens
  useEffect(() => {
    if (isOpen && config && !showContactForm && messages.length === 0) {
      const initialMsg = config.initialMessage || `Hello! I'm ${config.name || 'your assistant'}. How can I help you today?`;
      setMessages([{
        id: 'initial',
        content: initialMsg,
        role: 'team',
        createdAt: new Date().toISOString(),
      }]);
    }
  }, [isOpen, config, messages.length, showContactForm]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Handle chat disconnect after inactivity
  const handleDisconnect = () => {
    if (fullPage) {
      // For full page, show a message
      setMessages(prev => [...prev, {
        id: `disconnect-${Date.now()}`,
        content: "Chat disconnected due to inactivity. Please refresh to start a new chat.",
        role: 'team',
        createdAt: new Date().toISOString(),
      }]);
      setThreadId(null);
    } else {
      // For widget, close the chat
      setIsOpen(false);
      setThreadId(null);
      setShowContactForm(true);
      setContactForm({ email: '', phone: '' });
      setCustomerInfo(null);
    }
  };

  // Handle contact form submission
  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.email || !contactForm.phone) return;

    setSubmittingContact(true);
    try {
      setCustomerInfo({ email: contactForm.email, phone: contactForm.phone });
      setShowContactForm(false);
    } catch (err) {
      console.error('Contact submission error:', err);
    } finally {
      setSubmittingContact(false);
    }
  };

  // Speech recognition
  const startListening = () => {
    if (!speechSupported) return;

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      updateActivity();
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputValue(transcript);
      updateActivity();
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !threadId || isSending) return;

    updateActivity(); // Reset inactivity timer

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: inputValue.trim(),
      role: 'customer',
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsSending(true);
    setIsTyping(true);

    try {
      await sendMessage(threadId, inputValue.trim());
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        content: 'Failed to send message. Please try again.',
        role: 'team',
        createdAt: new Date().toISOString(),
      }]);
      setIsTyping(false);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setThreadId(null);
    setMessages([]);
    setShowContactForm(true);
    setContactForm({ email: '', phone: '' });
    setCustomerInfo(null);
  };

  // Theme and colors
  const theme = config?.theme || 'light';
  const defaults = THEME_DEFAULTS[theme];
  const colors = {
    headerColor: config?.mainColor || defaults.headerColor,
    headerTextColor: config?.mainTextColor || defaults.headerTextColor,
    sendBgColor: config?.sendBgColor || defaults.sendBgColor,
    sendTextColor: config?.sendTextColor || defaults.sendTextColor,
    receiveBgColor: config?.receiveBgColor || defaults.receiveBgColor,
    receiveTextColor: config?.receiveTextColor || defaults.receiveTextColor,
    chatBgColor: config?.isPlainBackground ? (config?.chatBgColor || defaults.chatBgColor) : defaults.chatBgColor,
    inputBgColor: defaults.inputBgColor,
    inputTextColor: defaults.inputTextColor,
    inputBorderColor: defaults.inputBorderColor,
    containerBgColor: defaults.containerBgColor,
  };

  const photoUrl = config?.photoUrl
    ? (config.photoUrl.startsWith('http') ? config.photoUrl : `${getApiBaseUrl().replace('/api', '')}${config.photoUrl}`)
    : DEFAULT_BOT_IMAGE;

  const chatIconUrl = config?.chatIconUrl
    ? (config.chatIconUrl.startsWith('http') ? config.chatIconUrl : `${getApiBaseUrl().replace('/api', '')}${config.chatIconUrl}`)
    : null;

  // Error state
  if (error && !config) {
    return fullPage ? (
      <div className="flex items-center justify-center w-full h-screen bg-gray-50">
        <div className="p-8 text-center">
          <p className="text-lg text-red-500">{error}</p>
          <p className="mt-2 text-sm text-gray-500">Please check your widget ID and backend URL in .env</p>
        </div>
      </div>
    ) : null;
  }

  // Loading state
  if (isLoading) {
    return fullPage ? (
      <div className="flex items-center justify-center w-full h-screen bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-500 rounded-full animate-spin border-t-transparent" />
      </div>
    ) : null;
  }

  // --- Full Page Mode ---
  if (fullPage) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-gradient-to-br from-gray-100 to-gray-200">
        <div
          className="flex flex-col overflow-hidden rounded-2xl shadow-2xl"
          style={{
            width: config?.width || '420px',
            height: config?.height || '680px',
            maxWidth: '95vw',
            maxHeight: '95vh',
          }}
        >
          {showContactForm ? (
            <ContactForm
              config={config}
              colors={colors}
              photoUrl={photoUrl}
              email={contactForm.email}
              phone={contactForm.phone}
              submitting={submittingContact}
              onEmailChange={(val) => setContactForm({ ...contactForm, email: val })}
              onPhoneChange={(val) => setContactForm({ ...contactForm, phone: val })}
              onSubmit={handleContactSubmit}
              onClose={undefined}
            />
          ) : (
            <ChatContent
              config={config}
              colors={colors}
              photoUrl={photoUrl}
              messages={messages}
              inputValue={inputValue}
              isSending={isSending}
              isTyping={isTyping}
              messagesEndRef={messagesEndRef}
              inputRef={inputRef}
              onInputChange={setInputValue}
              onSend={handleSend}
              onKeyDown={handleKeyDown}
              onNewChat={handleNewChat}
              onClose={undefined}
              speechSupported={speechSupported}
              isListening={isListening}
              onVoiceToggle={startListening}
            />
          )}
        </div>
      </div>
    );
  }

  // --- Floating Widget Mode ---
  const isLeft = config?.isLeftIcon;
  const zIndex = config?.zIndex || 9999;

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div
          className="fixed overflow-hidden rounded-2xl shadow-2xl flex flex-col"
          style={{
            width: config?.width || '400px',
            height: config?.height || '70vh',
            maxWidth: '95vw',
            maxHeight: '85vh',
            zIndex: zIndex + 1,
            bottom: '90px',
            ...(isLeft ? { left: '20px' } : { right: '20px' }),
          }}
        >
          {showContactForm ? (
            <ContactForm
              config={config}
              colors={colors}
              photoUrl={photoUrl}
              email={contactForm.email}
              phone={contactForm.phone}
              submitting={submittingContact}
              onEmailChange={(val) => setContactForm({ ...contactForm, email: val })}
              onPhoneChange={(val) => setContactForm({ ...contactForm, phone: val })}
              onSubmit={handleContactSubmit}
              onClose={() => setIsOpen(false)}
            />
          ) : (
            <ChatContent
              config={config}
              colors={colors}
              photoUrl={photoUrl}
              messages={messages}
              inputValue={inputValue}
              isSending={isSending}
              isTyping={isTyping}
              messagesEndRef={messagesEndRef}
              inputRef={inputRef}
              onInputChange={setInputValue}
              onSend={handleSend}
              onKeyDown={handleKeyDown}
              onNewChat={handleNewChat}
              onClose={() => setIsOpen(false)}
              speechSupported={speechSupported}
              isListening={isListening}
              onVoiceToggle={startListening}
            />
          )}
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
        style={{
          zIndex,
          bottom: '20px',
          ...(isLeft ? { left: '20px' } : { right: '20px' }),
          backgroundColor: colors.headerColor,
        }}
      >
        {isOpen ? (
          <X size={24} style={{ color: colors.headerTextColor }} />
        ) : chatIconUrl ? (
          <img src={chatIconUrl} alt="Chat" className="object-cover w-10 h-10 rounded-full" />
        ) : (
          <MessageCircle size={24} style={{ color: colors.headerTextColor }} />
        )}
      </button>
    </>
  );
}

// --- ContactForm: Initial contact collection ---
interface ContactFormProps {
  config: WidgetConfig | null;
  colors: Record<string, string>;
  photoUrl: string;
  email: string;
  phone: string;
  submitting: boolean;
  onEmailChange: (val: string) => void;
  onPhoneChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: (() => void) | undefined;
}

function ContactForm({
  config,
  colors,
  photoUrl,
  email,
  phone,
  submitting,
  onEmailChange,
  onPhoneChange,
  onSubmit,
  onClose,
}: ContactFormProps) {
  return (
    <>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ backgroundColor: colors.headerColor, color: colors.headerTextColor }}
      >
        <img
          src={photoUrl}
          alt={config?.name || 'Bot'}
          className="object-cover w-10 h-10 rounded-full border border-white/20"
          onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_BOT_IMAGE; }}
        />
        <div className="flex-1 min-w-0">
          <h4 className="text-base font-semibold truncate">{config?.name || 'Assistant'}</h4>
          <p className="text-sm truncate opacity-80">Before we start, please share your details</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 transition-colors">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Contact Form */}
      <div className="flex-1 p-4" style={{ backgroundColor: colors.chatBgColor }}>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.inputTextColor }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={submitting}
              className="w-full px-4 py-2 text-sm rounded-lg outline-none disabled:opacity-50"
              style={{
                backgroundColor: colors.inputBgColor,
                color: colors.inputTextColor,
                border: `1px solid ${colors.inputBorderColor}`,
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.inputTextColor }}>
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              placeholder="+1 234 567 8900"
              required
              disabled={submitting}
              className="w-full px-4 py-2 text-sm rounded-lg outline-none disabled:opacity-50"
              style={{
                backgroundColor: colors.inputBgColor,
                color: colors.inputTextColor,
                border: `1px solid ${colors.inputBorderColor}`,
              }}
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !email || !phone}
            className="w-full py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-30"
            style={{
              backgroundColor: colors.sendBgColor,
              color: colors.sendTextColor,
            }}
          >
            {submitting ? 'Starting chat...' : 'Start Chat'}
          </button>
          <p className="text-xs text-center opacity-60" style={{ color: colors.inputTextColor }}>
            We'll use this to follow up on your conversation
          </p>
        </form>
      </div>
    </>
  );
}

// --- ChatContent: Shared between full-page and widget ---
interface ChatContentProps {
  config: WidgetConfig | null;
  colors: Record<string, string>;
  photoUrl: string;
  messages: Message[];
  inputValue: string;
  isSending: boolean;
  isTyping: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  inputRef: React.RefObject<HTMLInputElement>;
  onInputChange: (val: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onNewChat: () => void;
  onClose: (() => void) | undefined;
  speechSupported: boolean;
  isListening: boolean;
  onVoiceToggle: () => void;
}

function ChatContent({
  config,
  colors,
  photoUrl,
  messages,
  inputValue,
  isSending,
  isTyping,
  messagesEndRef,
  inputRef,
  onInputChange,
  onSend,
  onKeyDown,
  onNewChat,
  onClose,
  speechSupported,
  isListening,
  onVoiceToggle,
}: ChatContentProps) {
  return (
    <>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ backgroundColor: colors.headerColor, color: colors.headerTextColor }}
      >
        <img
          src={photoUrl}
          alt={config?.name || 'Bot'}
          className="object-cover w-10 h-10 rounded-full border border-white/20"
          onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_BOT_IMAGE; }}
        />
        <div className="flex-1 min-w-0">
          <h4 className="text-base font-semibold truncate">{config?.name || 'Assistant'}</h4>
          <p className="text-sm truncate opacity-80">{config?.description || 'How can I help you?'}</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 transition-colors">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4" style={{ backgroundColor: colors.chatBgColor }}>
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'customer' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                  msg.role === 'customer'
                    ? 'rounded-br-sm'
                    : 'rounded-bl-sm'
                }`}
                style={{
                  backgroundColor: msg.role === 'customer' ? colors.sendBgColor : colors.receiveBgColor,
                  color: msg.role === 'customer' ? colors.sendTextColor : colors.receiveTextColor,
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div
              className="self-start px-4 py-3 rounded-2xl rounded-bl-sm max-w-[80%]"
              style={{ backgroundColor: colors.receiveBgColor }}
            >
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full typing-dot" style={{ backgroundColor: colors.receiveTextColor, opacity: 0.5 }} />
                <span className="w-2 h-2 rounded-full typing-dot" style={{ backgroundColor: colors.receiveTextColor, opacity: 0.5 }} />
                <span className="w-2 h-2 rounded-full typing-dot" style={{ backgroundColor: colors.receiveTextColor, opacity: 0.5 }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div
        className="px-3 py-3 shrink-0"
        style={{ backgroundColor: colors.containerBgColor }}
      >
        <div className="flex items-center gap-2">
          <button className="p-2 transition-opacity rounded-full hover:opacity-70">
            <Smile size={20} style={{ color: colors.inputTextColor }} />
          </button>
          {speechSupported && (
            <button
              onClick={onVoiceToggle}
              className={`p-2 transition-opacity rounded-full hover:opacity-70 ${isListening ? 'animate-pulse' : ''}`}
              style={{ color: isListening ? '#ef4444' : colors.inputTextColor }}
            >
              <Mic size={20} />
            </button>
          )}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message..."
            disabled={isSending}
            className="flex-1 px-4 py-2 text-sm rounded-full outline-none disabled:opacity-50"
            style={{
              backgroundColor: colors.inputBgColor,
              color: colors.inputTextColor,
              border: `1px solid ${colors.inputBorderColor}`,
            }}
          />
          <button
            onClick={onSend}
            disabled={!inputValue.trim() || isSending}
            className="p-2 transition-opacity rounded-full hover:opacity-70 disabled:opacity-30"
          >
            <Send size={20} style={{ color: colors.inputTextColor }} />
          </button>
        </div>

        {/* Footer */}
        <div className="mt-2 text-center">
          <span className="text-xs text-gray-400">
            Powered by PrimePath Chatbot
          </span>
        </div>
      </div>
    </>
  );
}
