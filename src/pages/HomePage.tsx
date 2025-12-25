import React, { useState, useEffect, useRef } from 'react';
import { Send, Trash2, Brain, Loader2, Image as ImageIcon, X, Paperclip, Sparkles } from 'lucide-react';
import { chatService, MODELS } from '@/lib/chat';
import { Button } from '@/components/ui/button';
import { SketchCard } from '@/components/ui/sketch-card';
import { LessonSidebar } from '@/components/lesson-sidebar';
import ReactMarkdown from 'react-markdown';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
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
      setTutorState(res.data.tutorState);
    }
  };
  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Only images are supported for homework help.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setPendingImage(e.target?.result as string);
    reader.readAsDataURL(file);
  };
  const handleSend = async () => {
    if ((!input.trim() && !pendingImage) || isLoading) return;
    const userMsgText = input;
    const userImage = pendingImage;
    setInput('');
    setPendingImage(null);
    setIsLoading(true);
    setStreamingText('');
    const optimisticMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMsgText,
      timestamp: Date.now(),
      attachments: userImage ? [{ type: 'image', url: userImage }] : undefined
    };
    setMessages(prev => [...prev, optimisticMsg]);
    try {
      const res = await chatService.sendMessage(userMsgText, selectedModel, (chunk) => {
        setStreamingText(prev => prev + chunk);
      }, userImage || undefined);
      if (!res.success) {
        toast.error(res.error || 'The tutor encountered an error.');
      }
      await loadHistory();
    } catch (e) {
      toast.error('Connection lost. Please try again.');
    } finally {
      setIsLoading(false);
      setStreamingText('');
    }
  };
  const clearChat = async () => {
    await chatService.clearMessages();
    setMessages([]);
    setTutorState({ plan: [], currentStepIndex: 0, isLessonInitialized: false });
    toast.success('Session reset successfully.');
  };
  const currentModelName = MODELS.find(m => m.id === selectedModel)?.name || 'AI Tutor';
  return (
    <div className="flex h-screen bg-[#FDFBF7] text-[#2D3436] font-sans overflow-hidden">
      {/* Sidebar - Desktop Only */}
      <aside className="hidden md:flex w-80 lg:w-96 shrink-0 flex-col border-r-2 border-black bg-paper">
        <LessonSidebar 
          steps={tutorState.plan} 
          currentIndex={tutorState.currentStepIndex} 
        />
      </aside>
      {/* Main Content */}
      <main className="flex-1 flex flex-col relative bg-[#FDFBF7]">
        {/* Header */}
        <header className="h-16 border-b-2 border-black flex items-center justify-between px-6 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="p-1 border-2 border-black bg-yellow-400 rotate-3 shadow-hard-sm">
              <Brain className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black italic tracking-tighter">ThinkStep</h1>
          </div>
          <div className="flex items-center gap-4">
             <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-40 h-9 border-2 border-black shadow-hard-sm bg-white text-xs font-bold">
                  <Sparkles className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-2 border-black rounded-none">
                  {MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs font-bold">{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            <Button variant="ghost" onClick={clearChat} className="h-9 px-3 text-xs border-2 border-transparent hover:border-red-600 hover:text-red-600 rounded-none transition-all">
              <Trash2 className="w-4 h-4 mr-1" /> Reset
            </Button>
          </div>
        </header>
        {/* Message Viewport */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 scroll-smooth">
          <div className="max-w-4xl mx-auto py-8 md:py-10 lg:py-12 space-y-8">
            {messages.length === 0 && (
              <div className="text-center space-y-6 pt-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="w-20 h-20 bg-yellow-400 border-4 border-black mx-auto rotate-6 shadow-hard flex items-center justify-center">
                   <Brain className="w-10 h-10" />
                </div>
                <h2 className="text-4xl font-black italic leading-tight">Ready to master a new topic?</h2>
                <p className="font-hand text-xl text-ink-muted max-w-md mx-auto">
                  Type your problem or drag a photo of your homework here to start our lesson.
                </p>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={cn("flex w-full animate-in fade-in duration-300", m.role === 'user' ? "justify-end" : "justify-start")}>
                <SketchCard
                  variant={m.role === 'user' ? 'accent' : 'default'}
                  image={m.attachments?.[0]?.url}
                  className={cn(
                    "max-w-[90%] md:max-w-[75%]",
                    m.role === 'user' ? "-rotate-1" : "rotate-1"
                  )}
                >
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </SketchCard>
              </div>
            ))}
            {(streamingText || isLoading) && (
              <div className="flex justify-start animate-in fade-in duration-300">
                <SketchCard className="max-w-[90%] md:max-w-[75%] rotate-1">
                  {streamingText ? (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{streamingText}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 font-hand text-lg py-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {currentModelName} is thinking...
                    </div>
                  )}
                </SketchCard>
              </div>
            )}
          </div>
        </div>
        {/* Sticky Input Bar */}
        <div className="w-full bg-gradient-to-t from-paper via-paper to-transparent pb-8 pt-4 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto relative">
            {pendingImage && (
              <div className="absolute -top-32 left-0 animate-in slide-in-from-bottom-4">
                <div className="relative p-2 bg-white border-2 border-black shadow-hard -rotate-2">
                  <img src={pendingImage} alt="Preview" className="h-24 w-auto object-contain" />
                  <button 
                    onClick={() => setPendingImage(null)}
                    className="absolute -top-2 -right-2 bg-black text-white p-1 rounded-full hover:scale-110 transition-transform"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
            <div className="relative group">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="How do I solve this step by step?"
                className="w-full p-5 pl-14 border-2 border-black bg-white shadow-hard focus:outline-none focus:ring-4 focus:ring-yellow-400/30 text-lg transition-all"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-ink-muted hover:text-black transition-colors"
              >
                <Paperclip className="w-6 h-6" />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} 
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                 <Button
                  onClick={handleSend}
                  disabled={isLoading || (!input.trim() && !pendingImage)}
                  className="bg-black hover:bg-black/90 text-white rounded-none h-12 w-12 p-0 shadow-hard-sm active:translate-y-0.5 active:shadow-none transition-all"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            </div>
            <p className="text-center text-[10px] text-ink-muted mt-4 font-medium uppercase tracking-widest">
              ThinkStep AI • Powered by GPT-4o Vision • Requests may be limited
            </p>
          </div>
        </div>
        {/* Drop Zone Overlay */}
        {isDragging && (
           <div className="absolute inset-0 z-50 bg-yellow-400/30 backdrop-blur-sm border-8 border-dashed border-black flex items-center justify-center p-12">
              <div className="bg-white p-12 border-4 border-black shadow-hard-lg rotate-2 text-center space-y-4">
                 <ImageIcon className="w-20 h-20 mx-auto animate-bounce" />
                 <h3 className="text-3xl font-black italic">Drop to share!</h3>
                 <p className="font-hand text-xl">I'll take a look at your problem immediately.</p>
              </div>
           </div>
        )}
      </main>
    </div>
  );
}