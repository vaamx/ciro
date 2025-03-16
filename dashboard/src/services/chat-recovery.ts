/**
 * Emergency Chat Recovery Utility
 * 
 * This file provides utilities to recover from catastrophic chat loading issues.
 * It works directly with local storage to bypass normal application flow.
 */

interface EmergencyChatSession {
  id: string;
  title: string;
  created_at: string;
}

/**
 * Creates an emergency chat session by directly manipulating localStorage
 * This bypasses all normal application flow and API calls
 */
export function createEmergencySession(): EmergencyChatSession {
  console.log('🚨 EMERGENCY: Creating direct session via localStorage');
  
  try {
    // Set emergency flag to force loading state reset on next page load
    localStorage.setItem('emergencyResetLoadingState', 'true');
    
    // Generate a unique ID
    const sessionId = `emergency_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Create a minimal session object
    const session: EmergencyChatSession = {
      id: sessionId,
      title: 'Emergency Chat',
      created_at: new Date().toISOString()
    };
    
    // Store minimal session data in localStorage
    localStorage.setItem('emergency_chat_session', JSON.stringify(session));
    localStorage.setItem('emergency_chat_active', 'true');
    localStorage.setItem('emergency_chat_messages', JSON.stringify([]));
    
    console.log('Successfully created emergency session:', session);
    
    // Register a listener for the next page load to handle this emergency session
    registerEmergencyHandler();
    
    return session;
  } catch (error) {
    console.error('Failed to create emergency session:', error);
    throw error;
  }
}

/**
 * Registers a handler to detect and load emergency sessions on application start
 */
function registerEmergencyHandler() {
  try {
    localStorage.setItem('emergency_recovery_needed', 'true');
  } catch (error) {
    console.error('Failed to register emergency handler:', error);
  }
}

/**
 * Checks if emergency recovery is needed
 */
export function isEmergencyRecoveryNeeded(): boolean {
  return localStorage.getItem('emergency_recovery_needed') === 'true';
}

/**
 * Gets the emergency session if it exists
 */
export function getEmergencySession(): EmergencyChatSession | null {
  try {
    const sessionData = localStorage.getItem('emergency_chat_session');
    if (!sessionData) return null;
    
    return JSON.parse(sessionData);
  } catch (error) {
    console.error('Error getting emergency session:', error);
    return null;
  }
}

/**
 * Clear all emergency data
 */
export function clearEmergencyData() {
  try {
    localStorage.removeItem('emergency_chat_session');
    localStorage.removeItem('emergency_chat_active');
    localStorage.removeItem('emergency_chat_messages');
    localStorage.removeItem('emergency_recovery_needed');
  } catch (error) {
    console.error('Error clearing emergency data:', error);
  }
}

/**
 * Reset all chat-related localStorage to fix persistent issues
 */
export function resetAllChatData() {
  const keysToRemove: string[] = [];
  
  // Identify chat-related keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.includes('chat') || 
      key.includes('message') || 
      key.includes('session')
    )) {
      keysToRemove.push(key);
    }
  }
  
  // Remove the keys
  keysToRemove.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to remove key ${key}:`, error);
    }
  });
  
  console.log(`Reset ${keysToRemove.length} chat data items from localStorage`);
}

/**
 * Recover from blank chat screen by checking for and restoring messages
 * @returns {boolean} Whether recovery was attempted
 */
export function recoverFromBlankChatScreen(): boolean {
  console.log('Attempting to recover from blank chat screen...');
  
  try {
    // Check if this was already handled by emergency reset
    const nonReloadRecovery = localStorage.getItem('non_reload_recovery');
    if (nonReloadRecovery === 'true') {
      console.log('Recovery already handled by emergency reset mechanism, skipping reload');
      // Clear the flag for future recoveries
      localStorage.removeItem('non_reload_recovery');
      return true;
    }
    
    // Check if this is happening shortly after a data source change
    const lastDataSourceChange = localStorage.getItem('last_data_source_change');
    if (lastDataSourceChange) {
      const changeTime = parseInt(lastDataSourceChange, 10);
      const timeSinceChange = Date.now() - changeTime;
      
      // If a data source was changed in the last 3 seconds, ignore recovery
      // This helps prevent unnecessary reloads when switching data sources
      if (timeSinceChange < 3000) {
        console.log('Data source was recently changed, skipping recovery to avoid reload loop');
        return false;
      }
    }

    // Check if we have an emergency backup from a blank screen
    const emergencyBackup = localStorage.getItem('blank_screen_recovery_messages');
    if (emergencyBackup) {
      console.log('Found emergency message backup');
      
      try {
        // Parse the messages
        const messages = JSON.parse(emergencyBackup);
        
        // If we have messages and a recovery function attached to window, use it
        if (Array.isArray(messages) && messages.length > 0) {
          // Look for the active session ID in messages metadata
          let sessionId = null;
          for (const msg of messages) {
            if (msg.metadata && msg.metadata.sessionId) {
              sessionId = msg.metadata.sessionId;
              break;
            }
          }
          
          // If we found a session ID, try to restore to that session
          if (sessionId) {
            localStorage.setItem(`chat_messages_${sessionId}`, emergencyBackup);
            console.log(`Restored messages to session ${sessionId}`);
          }
          
          // Clean up emergency backup
          localStorage.removeItem('blank_screen_recovery_messages');
          
          // Force page refresh to apply recovery - use a gentler approach
          // Only force reload if it's been at least 5 seconds since last reload
          const lastReload = localStorage.getItem('last_page_reload');
          const now = Date.now();
          
          if (!lastReload || (now - parseInt(lastReload, 10)) > 5000) {
            localStorage.setItem('last_page_reload', now.toString());
            window.location.reload();
            return true;
          } else {
            console.log('Skipping reload - too soon after previous reload');
            return false;
          }
        }
      } catch (e) {
        console.error('Failed to parse emergency backup:', e);
      }
    }
    
    // Check if PDF processing is causing the issue
    const lastMessages = findLastSavedMessages();
    if (lastMessages && lastMessages.length > 0) {
      console.log('Found previous session messages, attempting recovery');
      
      // Get the active session if available
      const activeSessionId = localStorage.getItem('active_chat_session');
      if (activeSessionId) {
        localStorage.setItem(`chat_messages_${activeSessionId}`, JSON.stringify(lastMessages));
        console.log(`Restored messages to active session ${activeSessionId}`);
        
        // Only force reload if it's been at least 5 seconds since last reload
        const lastReload = localStorage.getItem('last_page_reload');
        const now = Date.now();
        
        if (!lastReload || (now - parseInt(lastReload, 10)) > 5000) {
          localStorage.setItem('last_page_reload', now.toString());
          window.location.reload();
          return true;
        } else {
          console.log('Skipping reload - too soon after previous reload');
          return false;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error in chat recovery:', error);
    return false;
  }
}

/**
 * Find last saved messages from any session
 * @returns {Array|null} Array of messages or null if none found
 */
function findLastSavedMessages(): any[] | null {
  try {
    // Get all localStorage keys
    let mostRecentMessages = null;
    let mostRecentTimestamp = 0;
    
    // Look for regular message keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('chat_messages_')) {
        try {
          const messages = JSON.parse(localStorage.getItem(key) || '[]');
          if (Array.isArray(messages) && messages.length > 0) {
            // Check for timestamps to find most recent
            const lastMessage = messages[messages.length - 1];
            if (lastMessage && lastMessage.timestamp && lastMessage.timestamp > mostRecentTimestamp) {
              mostRecentTimestamp = lastMessage.timestamp;
              mostRecentMessages = messages;
            }
          }
        } catch (e) {
          console.error(`Error parsing messages for key ${key}:`, e);
        }
      }
    }
    
    // Look for backup keys if no regular messages found
    if (!mostRecentMessages) {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('chat_messages_backup_')) {
          try {
            const messages = JSON.parse(localStorage.getItem(key) || '[]');
            if (Array.isArray(messages) && messages.length > 0) {
              const lastMessage = messages[messages.length - 1];
              if (lastMessage && lastMessage.timestamp && lastMessage.timestamp > mostRecentTimestamp) {
                mostRecentTimestamp = lastMessage.timestamp;
                mostRecentMessages = messages;
              }
            }
          } catch (e) {
            console.error(`Error parsing backup for key ${key}:`, e);
          }
        }
      }
    }
    
    return mostRecentMessages;
  } catch (error) {
    console.error('Error finding last saved messages:', error);
    return null;
  }
} 