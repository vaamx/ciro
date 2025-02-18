import React from 'react';
import { motion } from 'framer-motion';

interface TypingIndicatorProps {
  participants: {
    id: string;
    name: string;
    avatar?: string;
  }[];
  bubbleStyle?: 'modern' | 'classic' | 'minimal';
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ participants, bubbleStyle = 'modern' }) => {
  const dots = [0, 1, 2];
  const names = participants.map(p => p.name).join(', ');
  const text = participants.length === 1 
    ? `${names} is typing`
    : `${names} are typing`;

  return (
    <div className={`
      flex items-center space-x-2 p-2
      ${bubbleStyle === 'modern' ? 'rounded-lg bg-gray-100 dark:bg-gray-800' :
        bubbleStyle === 'minimal' ? '' : 'rounded-md bg-gray-50 dark:bg-gray-900'}
    `}>
      {participants.length <= 2 && participants.map(participant => (
        participant.avatar ? (
          <img
            key={participant.id}
            src={participant.avatar}
            alt={`${participant.name}'s avatar`}
            className="w-6 h-6 rounded-full"
          />
        ) : (
          <div
            key={participant.id}
            className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-600 dark:text-gray-300"
          >
            {participant.name.charAt(0)}
          </div>
        )
      ))}
      
      <span className="text-sm text-gray-500 dark:text-gray-400">{text}</span>
      
      <div className="flex space-x-1">
        {dots.map((dot) => (
          <motion.div
            key={dot}
            className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-600"
            animate={{
              y: ["0%", "-50%", "0%"],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: dot * 0.2,
            }}
          />
        ))}
      </div>
    </div>
  );
}; 