import React from 'react';
import { cn } from '@/lib/utils';
interface SketchCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'paper' | 'accent';
}
export function SketchCard({ 
  children, 
  className, 
  variant = 'default',
  ...props 
}: SketchCardProps) {
  const variants = {
    default: 'bg-white',
    paper: 'bg-[#FDFBF7]',
    accent: 'bg-yellow-50'
  };
  return (
    <div 
      className={cn(
        "border-2 border-black rounded-none shadow-hard transition-all",
        variants[variant],
        className
      )}
      {...props}
    >
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}