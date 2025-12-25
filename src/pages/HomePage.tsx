import React, { useState, useEffect, useRef } from 'react';
import { Send, Trash2, Brain, Loader2, Image as ImageIcon, X, Paperclip } from 'lucide-react';
import { chatService } from '@/lib/chat';
import { Button } from '@/components/ui/button';
import { SketchCard } from '@/components/ui/sketch-card';
import { LessonSidebar } from '@/components/lesson-sidebar';
import ReactMarkdown from 'react-markdown';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MODELS } from '@/lib/chat';
import type { Message, TutorState } from '@/lib/chat';
export function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [tutorState, setTutorState] = useState<TutorState>({
    plan: [],
    currentStepIndex: 0,
    isLessonInitialized: false
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      setTutorState(res.data.tutorState || { plan: [], currentStepIndex: 0, isLessonInitialized: false });
    }
  };
  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image (JPG/PNG).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setPendingImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };
  const handleSend = async () => {
    if ((!input.trim() && !pendingImage) || isLoading) return;
    const userMsg = input;
    const currentImage = pendingImage;
    setInput('');
    setPendingImage(null);
    setIsLoading(true);
    setStreamingText('');
    const tempUserMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMsg,
      timestamp: Date.now(),
      attachments: currentImage ? [{ type: 'image', url: currentImage }] : undefined
    };
    setMessages(prev => [...prev, tempUserMsg]);
    try {
      await chatService.sendMessage(userMsg, selectedModel, (chunk) => {
        setStreamingText(prev => prev + chunk);
      }, currentImage || undefined);
      await loadHistory();
    } catch (e) {
      console.error(e);
      toast.error('Failed to send message.');
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
    <div 
      className="flex h-screen bg-[#FDFBF7] text-[#2D3436] font-sans overflow-hidden"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleImageUpload(file);
      }}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-yellow-400/20 backdrop-blur-sm border-4 border-dashed border-black flex items-center justify-center">
          <div className="bg-white p-8 border-2 border-black shadow-hard text-center rotate-2">
            <ImageIcon className="w-16 h-16 mx-auto mb-4" />
            <p className="text-2xl font-black">Drop to teach me!</p>
          </div>
        </div>
      )}
      {/* Sidebar Area */}
      <aside className="hidden md:block w-80 lg:w-96 shrink-0 border-r-2 border-black bg-paper">
        <LessonSidebar steps={tutorState.plan.map((step: any) => ({ title: step.goal || 'Untitled Step', goal: step.goal, status: step.status }))} currentIndex={tutorState.currentStepIndex} />
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
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 pb-40 scroll-smooth">
          {messages.length === 0 && (
            <div className="max-w-2xl mx-auto pt-20 text-center space-y-4">
              <h2 className="text-4xl font-black italic">What can I help you learn today?</h2>
              <p className="font-hand text-xl text-ink-muted">Type a problem or upload a photo of your homework!</p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={cn("flex w-full", m.role === 'user' ? "justify-end" : "justify-start")}>
              <SketchCard
                variant={m.role === 'user' ? 'accent' : 'default'}
                image={m.attachments?.[0]?.url}
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
          <div className="max-w-4xl mx-auto">
            {/* Image Preview Area */}
            {pendingImage && (
              <div className="mb-4 flex justify-start">
                <div className="relative p-2 bg-white border-2 border-black shadow-hard -rotate-2 group">
                  <img src={pendingImage} alt="Preview" className="h-24 w-auto object-contain border border-black" />
                  <button
                    onClick={() => setPendingImage(null)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white p-1 border-2 border-black rounded-full hover:scale-110 transition-transform"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-end gap-3 mb-3">
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-48 h-10 border-2 border-black shadow-hard-sm bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask your tutor or upload a problem..."
                  className="w-full p-4 pl-12 border-2 border-black bg-white shadow-hard focus:outline-none focus:ring-2 focus:ring-yellow-400 text-lg transition-all"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1 hover:text-yellow-600 transition-colors"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                    }} 
                  />
                </div>
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Button
                    onClick={handleSend}
                    disabled={isLoading || (!input.trim() && !pendingImage)}
                    className="bg-black hover:bg-black/90 text-white rounded-none h-10 w-10 p-0 shadow-hard-sm"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <p className="text-center text-[10px] text-ink-muted mt-4">
            ThinkStep AI is a learning assistant. Limit on AI requests may apply.
          </p>
        </div>
      </main>
    </div>
  );
}