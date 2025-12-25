import React from 'react';
import { CheckCircle2, Circle, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LessonStep } from '../../worker/types';
interface LessonSidebarProps {
  steps: LessonStep[];
  currentIndex: number;
}
export function LessonSidebar({ steps, currentIndex }: LessonSidebarProps) {
  if (steps.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center border-r-2 border-black bg-paper">
        <div className="w-16 h-16 border-2 border-black rounded-full flex items-center justify-center mb-4">
          <PlayCircle className="w-8 h-8" />
        </div>
        <p className="font-hand text-lg">Your lesson roadmap will appear here once we start!</p>
      </div>
    );
  }
  return (
    <div className="h-full flex flex-col p-6 bg-paper border-r-2 border-black overflow-y-auto">
      <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
        <span className="w-8 h-8 bg-black text-white flex items-center justify-center rounded-sm">L</span>
        Lesson Plan
      </h2>
      <div className="space-y-6">
        {steps.map((step, idx) => {
          const isActive = idx === currentIndex;
          const isCompleted = idx < currentIndex || step.status === 'completed';
          return (
            <div 
              key={idx} 
              className={cn(
                "relative pl-8 transition-opacity",
                !isActive && !isCompleted && "opacity-50"
              )}
            >
              {/* Vertical line connector */}
              {idx !== steps.length - 1 && (
                <div className="absolute left-[11px] top-7 bottom-[-24px] w-[2px] bg-black" />
              )}
              <div className="absolute left-0 top-1">
                {isCompleted ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600 fill-green-50" />
                ) : isActive ? (
                  <div className="w-6 h-6 border-2 border-black rounded-full bg-yellow-400 flex items-center justify-center animate-pulse" />
                ) : (
                  <Circle className="w-6 h-6" />
                )}
              </div>
              <div className={cn(
                "p-3 border-2 border-black shadow-hard-sm",
                isActive ? "bg-white" : "bg-paper-dark"
              )}>
                <p className="text-xs uppercase font-bold tracking-wider mb-1">Step {idx + 1}</p>
                <h3 className="font-bold leading-tight">{step.title}</h3>
                {isActive && (
                  <p className="text-sm mt-2 font-hand text-ink-muted">{step.goal}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}