import React, { useEffect, useState } from 'react';
// Define the necessary interfaces locally to avoid import errors
interface CollaborationUser {
  id: string;
  name: string;
  email?: string;
  color: string;
  isActive: boolean;
  cursor?: { x: number; y: number };
  avatar?: string;
}

interface CollaborationSession {
  id: string;
  workspaceId: string;
  users: CollaborationUser[];
  createdAt: string;
  isActive: boolean;
}

// Define Message Type enum
enum MessageType {
  JOIN = 'join',
  LEAVE = 'leave',
  CURSOR_MOVE = 'cursor_move'
}

// Mock implementation of onCollaborationEvent to avoid import errors
const onCollaborationEvent = (_type: MessageType, _callback: (data: any) => void) => {
  // This is a mock implementation
  return () => { /* cleanup function */ };
};

import { X, Users, Circle } from 'lucide-react';

interface CollaborationOverlayProps {
  session: CollaborationSession;
  currentUser: CollaborationUser;
}

/**
 * Component to display collaboration features like user cursors, selections, and active collaborators
 */
export const CollaborationOverlay: React.FC<CollaborationOverlayProps> = ({ 
  session, 
  currentUser 
}) => {
  const [otherUsers, setOtherUsers] = useState<CollaborationUser[]>([]);
  const [cursors, setCursors] = useState<{[userId: string]: {x: number, y: number}}>({});
  const [showCollaborators, setShowCollaborators] = useState(true);

  // Initialize state from session
  useEffect(() => {
    if (!session) return;
    
    // Set other users
    setOtherUsers(session.users.filter((user: CollaborationUser) => user.id !== currentUser.id && user.isActive));
    
    // Set initial cursors
    const initialCursors: {[userId: string]: {x: number, y: number}} = {};
    session.users.forEach((user: CollaborationUser) => {
      if (user.cursor && user.id !== currentUser.id) {
        initialCursors[user.id] = { x: user.cursor.x, y: user.cursor.y };
      }
    });
    setCursors(initialCursors);
  }, [session, currentUser]);

  // Subscribe to collaboration events
  useEffect(() => {
    // Handle user joined
    const userJoinedUnsubscribe = onCollaborationEvent(MessageType.JOIN, (data: {user: CollaborationUser}) => {
      if (data.user.id !== currentUser.id && data.user.isActive) {
        setOtherUsers(prev => [...prev, data.user]);
      }
    });
    
    // Handle user left
    const userLeftUnsubscribe = onCollaborationEvent(MessageType.LEAVE, (data: {userId: string}) => {
      setOtherUsers(prev => prev.filter(user => user.id !== data.userId));
      setCursors(prev => {
        const newCursors = {...prev};
        delete newCursors[data.userId];
        return newCursors;
      });
    });
    
    // Handle cursor moved
    const cursorMovedUnsubscribe = onCollaborationEvent(MessageType.CURSOR_MOVE, 
      (data: {userId: string, cursor: {x: number, y: number}}) => {
        if (data.userId === currentUser.id) return;
        
        setCursors(prev => ({
          ...prev,
          [data.userId]: { x: data.cursor.x, y: data.cursor.y }
        }));
      }
    );
    
    // Clean up subscriptions
    return () => {
      userJoinedUnsubscribe();
      userLeftUnsubscribe();
      cursorMovedUnsubscribe();
    };
  }, [currentUser.id]);

  return (
    <>
      {/* User Cursors */}
      {Object.entries(cursors).map(([userId, position]) => {
        const user = otherUsers.find(u => u.id === userId);
        if (!user) return null;
        
        return (
          <div 
            key={userId}
            className="absolute pointer-events-none z-50 transition-all duration-200 ease-out"
            style={{ 
              left: `${position.x}px`, 
              top: `${position.y}px`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            {/* Cursor */}
            <div className="relative">
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none"
                style={{ color: user.color }}
              >
                <path 
                  d="M6 2L18 12L13 14L16 22L14 23L11 15L6 20L6 2Z" 
                  fill="currentColor" 
                  stroke="white" 
                  strokeWidth="1"
                />
              </svg>
              
              {/* User label */}
              <div 
                className="absolute left-5 top-0 px-2 py-1 text-xs text-white rounded whitespace-nowrap"
                style={{ backgroundColor: user.color }}
              >
                {user.name}
              </div>
            </div>
          </div>
        );
      })}
      
      {/* Collaborators panel toggle */}
      <div className="fixed bottom-4 right-4 z-40">
        <button 
          className={`p-3 rounded-full shadow-lg flex items-center justify-center ${
            showCollaborators ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 dark:bg-gray-700 dark:text-white'
          }`}
          onClick={() => setShowCollaborators(prev => !prev)}
        >
          <Users className="w-5 h-5" />
          {otherUsers.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 text-white text-xs flex items-center justify-center rounded-full">
              {otherUsers.length}
            </span>
          )}
        </button>
      </div>
      
      {/* Collaborators panel */}
      {showCollaborators && (
        <div className="fixed bottom-16 right-4 w-64 bg-white dark:bg-gray-800 shadow-xl rounded-lg overflow-hidden z-40 border border-gray-200 dark:border-gray-700">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className="font-medium text-gray-900 dark:text-white">Collaborators</h3>
            <button 
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              onClick={() => setShowCollaborators(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="p-2 max-h-72 overflow-y-auto">
            {otherUsers.length === 0 ? (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                No other collaborators
              </div>
            ) : (
              <div className="space-y-2">
                {otherUsers.map(user => (
                  <div 
                    key={user.id}
                    className="p-2 rounded-lg border border-gray-100 dark:border-gray-700 flex items-center"
                  >
                    {user.avatar ? (
                      <img 
                        src={user.avatar} 
                        alt={user.name} 
                        className="w-8 h-8 rounded-full mr-3"
                      />
                    ) : (
                      <div 
                        className="w-8 h-8 rounded-full mr-3 flex items-center justify-center text-sm text-white"
                        style={{ backgroundColor: user.color }}
                      >
                        {user.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {user.name}
                      </div>
                      <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                        <Circle className="w-2 h-2 mr-1 text-green-500 fill-current" />
                        Active now
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 text-xs text-center text-gray-500 dark:text-gray-400">
            {otherUsers.length > 0 
              ? `${otherUsers.length} collaborator${otherUsers.length > 1 ? 's' : ''} online` 
              : 'Share this workspace to collaborate'
            }
          </div>
        </div>
      )}
    </>
  );
};

export default CollaborationOverlay; 