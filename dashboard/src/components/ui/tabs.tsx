import React, { createContext, useContext } from 'react';
import { cn } from '../../utils/cn';

type TabsContextValue = {
  value: string;
  onValueChange: (value: string) => void;
};

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  onValueChange: (value: string) => void;
  defaultValue?: string;
  children: React.ReactNode;
}

export function Tabs({ 
  value, 
  onValueChange, 
  defaultValue, 
  children, 
  className,
  ...props 
}: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn("w-full", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function TabsList({ children, className, ...props }: TabsListProps) {
  return (
    <div 
      className={cn(
        "flex gap-2 border-b border-gray-200 dark:border-gray-800", 
        className
      )} 
      {...props}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  children: React.ReactNode;
}

export function TabsTrigger({ value, children, className, ...props }: TabsTriggerProps) {
  const context = useContext(TabsContext);
  
  if (!context) {
    throw new Error("TabsTrigger must be used within a Tabs component");
  }
  
  const isActive = context.value === value;
  
  return (
    <button
      className={cn(
        "px-3 py-2 text-sm font-medium transition-colors rounded-t-md focus:outline-none",
        isActive 
          ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
          : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
        className
      )}
      onClick={() => context.onValueChange(value)}
      {...props}
    >
      <div className="flex items-center gap-1">
        {children}
      </div>
    </button>
  );
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  children: React.ReactNode;
}

export function TabsContent({ value, children, className, ...props }: TabsContentProps) {
  const context = useContext(TabsContext);
  
  if (!context) {
    throw new Error("TabsContent must be used within a Tabs component");
  }
  
  if (context.value !== value) {
    return null;
  }
  
  return (
    <div className={cn("mt-4", className)} {...props}>
      {children}
    </div>
  );
} 