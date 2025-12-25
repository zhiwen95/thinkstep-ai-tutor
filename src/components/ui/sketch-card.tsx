import React from 'react';
import { cn } from '@/lib/utils';
interface SketchCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'paper' | 'accent';
  image?: string;
}
export function SketchCard({
  children,
  className,
  variant = 'default',
  image,
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
        {image && (
          <div className="mb-4 relative group">
            {/* Taped-on effect */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-6 bg-white/60 border border-black/10 shadow-sm rotate-2 z-10" />
            <div className="p-2 bg-white border-2 border-black shadow-hard-sm -rotate-1">
              <img 
                src={image} 
                alt="Attachment" 
                className="w-full h-auto max-h-64 object-contain"
              />
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}