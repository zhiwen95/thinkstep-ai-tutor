import React, { useState, useEffect, useRef } from 'react';
import { Send, Trash2, Brain, Loader2 } from 'lucide-react';
import { chatService } from '@/lib/chat';
import { Button } from '@/components/ui/button';
import { SketchCard } from '@/components/ui/sketch-card';
import { LessonSidebar } from '@/components/lesson-sidebar';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import type { Message, ChatState } from '../../worker/types';
export function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [tutorState, setTutorState] = useState<ChatState['tutorState']>({
    plan: [],
    currentStepIndex: 0,
    isLessonInitialized: false
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    loadHistory();
  }, []);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);
  const loadHistory = async () => {
    const res = await chatService.getMessages();
    if (res.success && res.data) {
      setMessages(res.data.messages);
      setTutorState(res.data.tutorState);
    }
  };
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input;
    setInput('');
    setIsLoading(true);
    setStreamingText('');
    // Optimistic local update
    const tempUserMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMsg,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, tempUserMsg]);
    try {
      await chatService.sendMessage(userMsg, undefined, (chunk) => {
        setStreamingText(prev => prev + chunk);
      });
      // After stream finishes, refresh final state
      await loadHistory();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setStreamingText('');
    }
  };
  const clearChat = async () => {
    await chatService.clearMessages();
    setMessages([]);
    setTutorState({ plan: [], currentStepIndex: 0, isLessonInitialized: false });
  };
  return (
    <div className="flex h-screen bg-[#FDFBF7] text-[#2D3436] font-sans overflow-hidden">
      {/* Sidebar Area */}
      <aside className="hidden md:block w-80 lg:w-96 shrink-0 border-r-2 border-black bg-paper">
        <LessonSidebar steps={tutorState.plan} currentIndex={tutorState.currentStepIndex} />
      </aside>
      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative">
        <header className="h-16 border-b-2 border-black flex items-center justify-between px-6 bg-white z-10">
          <div className="flex items-center gap-2">
            <div className="p-1 border-2 border-black bg-yellow-400 rotate-3">
              <Brain className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black italic tracking-tight">ThinkStep AI</h1>
          </div>
          <Button variant="ghost" onClick={clearChat} className="text-xs hover:bg-red-50 hover:text-red-600 transition-colors">
            <Trash2 className="w-4 h-4 mr-2" /> Reset Lesson
          </Button>
        </header>
        {/* Scrollable messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 pb-32 scroll-smooth">
          {messages.length === 0 && (
            <div className="max-w-2xl mx-auto pt-20 text-center space-y-4">
              <h2 className="text-4xl font-black italic">What can I help you learn today?</h2>
              <p className="font-hand text-xl text-ink-muted">Type any topic or problem, and we'll break it down together.</p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={cn("flex w-full", m.role === 'user' ? "justify-end" : "justify-start")}>
              <SketchCard 
                variant={m.role === 'user' ? 'accent' : 'default'}
                className={cn(
                  "max-w-[85%] md:max-w-[70%]",
                  m.role === 'user' ? "-rotate-1" : "rotate-1"
                )}
              >
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </SketchCard>
            </div>
          ))}
          {streamingText && (
            <div className="flex justify-start">
              <SketchCard className="max-w-[85%] md:max-w-[70%] rotate-1">
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{streamingText}</ReactMarkdown>
                </div>
              </SketchCard>
            </div>
          )}
          {isLoading && !streamingText && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 font-hand animate-pulse ml-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Thinking...
              </div>
            </div>
          )}
        </div>
        {/* Input Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-paper via-paper/90 to-transparent">
          <div className="max-w-4xl mx-auto flex gap-3">
            <div className="relative flex-1">
              <input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask your tutor anything..."
                className="w-full p-4 border-2 border-black bg-white shadow-hard focus:outline-none focus:ring-2 focus:ring-yellow-400 text-lg transition-all"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                <Button 
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className="bg-black hover:bg-black/90 text-white rounded-none h-10 w-10 p-0 shadow-hard-sm"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
          <p className="text-center text-[10px] text-ink-muted mt-4">
            ThinkStep AI is a learning assistant. Please verify important facts. Limit on AI requests may apply.
          </p>
        </div>
      </main>
    </div>
  );
}