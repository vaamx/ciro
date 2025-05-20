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

/**
 * Clean up old chat sessions to free up storage space
 * @param maxAgeMs Maximum age of session data to keep (default: 30 days)
 * @param preserveLatest Number of recent sessions to preserve regardless of age (default: 5)
 * @param forceCleanup If true, will aggressively clean sessions even if they're not old
 * @returns Number of items cleaned up
 */
export function cleanupOldChatSessions(maxAgeMs = 30 * 24 * 60 * 60 * 1000, preserveLatest = 5, forceCleanup = false): number {
  console.log(`Cleaning up chat sessions older than ${maxAgeMs / (24 * 60 * 60 * 1000)} days...`);
  
  try {
    // Collect all chat session keys and their last access time
    const sessionData: {key: string, lastAccess: number, isBackup: boolean, size: number}[] = [];
    const now = Date.now();
    
    // First pass: collect all chat-related keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      // Only process chat message data
      if (key.startsWith('chat_messages_') || 
          key.startsWith('chat_compact_') || 
          key.startsWith('chat_messages_backup_') ||
          key.startsWith('chat_session_')) {
        
        // Try to extract session ID and timestamp from key
        let timestamp = 0;
        const isBackup = key.includes('backup_');
        
        // Extract embedded timestamp from backup keys if available
        if (isBackup && key.includes('_backup_')) {
          const parts = key.split('_backup_');
          if (parts.length > 1) {
            const possibleTimestamp = parseInt(parts[1], 10);
            if (!isNaN(possibleTimestamp)) {
              timestamp = possibleTimestamp;
            }
          }
        }
        
        // If no embedded timestamp, try to get access time from messages
        if (timestamp === 0) {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              // Calculate size of this item
              const size = data.length * 2; // Approximate size in bytes
              
              // Try to parse for timestamp if it's message data
              if (key.includes('messages')) {
                const messages = JSON.parse(data);
                if (Array.isArray(messages) && messages.length > 0) {
                  // Find the newest message timestamp
                  const newestTimestamp = Math.max(...messages
                    .filter(m => m && typeof m.timestamp === 'number')
                    .map(m => m.timestamp));
                  
                  if (newestTimestamp > 0) {
                    timestamp = newestTimestamp;
                  }
                }
              }
              
              sessionData.push({
                key,
                lastAccess: timestamp || now - maxAgeMs - 1, // Default to eligible for cleanup if no timestamp
                isBackup,
                size
              });
            }
          } catch (e) {
            // If parsing fails, use current time minus max age
            sessionData.push({
              key,
              lastAccess: now - maxAgeMs - 1, // Ensure it's eligible for cleanup
              isBackup,
              size: 0
            });
          }
        } else {
          // We already have a timestamp from the key name
          const data = localStorage.getItem(key) || '';
          sessionData.push({
            key,
            lastAccess: timestamp,
            isBackup,
            size: data.length * 2
          });
        }
      }
    }
    
    // Sort by access time (newest first)
    sessionData.sort((a, b) => b.lastAccess - a.lastAccess);
    
    // Preserve the latest N sessions
    const preservedKeys = new Set<string>();
    let preservedCount = 0;
    
    for (const item of sessionData) {
      // Skip backups when preserving latest
      if (!item.isBackup) {
        // Extract session ID from key
        const match = item.key.match(/chat_(?:messages|compact|session)_([^_]+)/);
        if (match && match[1]) {
          const sessionId = match[1];
          
          // Add all keys for this session to preserved set
          if (preservedCount < preserveLatest) {
            sessionData.forEach(sd => {
              if (sd.key.includes(sessionId)) {
                preservedKeys.add(sd.key);
              }
            });
            preservedCount++;
          }
        }
      }
    }
    
    // Identify items to remove:
    // 1. Old items (beyond maxAgeMs) and not preserved
    // 2. If forceCleanup is true, all non-preserved items ordered by size (largest first)
    let keysToRemove: string[];
    
    if (forceCleanup) {
      // In forced cleanup mode, we'll remove non-preserved items starting with largest
      const nonPreserved = sessionData
        .filter(item => !preservedKeys.has(item.key))
        .sort((a, b) => b.size - a.size);  // Sort by size, largest first
      
      keysToRemove = nonPreserved.map(item => item.key);
      console.log(`FORCED CLEANUP: Will remove ${keysToRemove.length} items to free up space`);
    } else {
      // Normal mode - just remove old items
      keysToRemove = sessionData
        .filter(item => !preservedKeys.has(item.key) && (now - item.lastAccess > maxAgeMs))
        .map(item => item.key);
    }
    
    // If we still don't have anything to remove but need forced cleanup
    if (keysToRemove.length === 0 && forceCleanup) {
      // As a last resort, remove older preserved items except the very latest
      preservedCount = 0;
      preservedKeys.clear();
      
      // Only preserve the single most recent session
      for (const item of sessionData) {
        if (!item.isBackup) {
          const match = item.key.match(/chat_(?:messages|compact|session)_([^_]+)/);
          if (match && match[1]) {
            const sessionId = match[1];
            
            if (preservedCount < 1) {  // Only preserve 1 session in emergency mode
              sessionData.forEach(sd => {
                if (sd.key.includes(sessionId)) {
                  preservedKeys.add(sd.key);
                }
              });
              preservedCount++;
            }
          }
        }
      }
      
      // Get all non-preserved keys
      keysToRemove = sessionData
        .filter(item => !preservedKeys.has(item.key))
        .map(item => item.key);
      
      console.log(`EMERGENCY CLEANUP: Preserving only the most recent session, will remove ${keysToRemove.length} items`);
    }
    
    // Remove the identified items
    let removedCount = 0;
    let removedBytes = 0;
    
    keysToRemove.forEach(key => {
      try {
        // Find the item to get its size for reporting
        const item = sessionData.find(sd => sd.key === key);
        const size = item ? item.size : 0;
        
        localStorage.removeItem(key);
        removedCount++;
        removedBytes += size;
      } catch (error) {
        console.error(`Failed to remove key ${key}:`, error);
      }
    });
    
    console.log(`Cleaned up ${removedCount} chat items (${(removedBytes/1024).toFixed(2)} KB) from localStorage`);
    return removedCount;
  } catch (error) {
    console.error('Error cleaning up chat sessions:', error);
    return 0;
  }
}

/**
 * Performs an emergency cleanup of localStorage when quota is exceeded
 * This aggressively removes older items to make space for critical operations
 * @returns Number of items cleaned up
 */
export function emergencyStorageCleanup(): number {
  console.log('Performing emergency storage cleanup...');
  
  try {
    // First try normal cleanup with a shorter retention period and more aggressive settings
    let cleanedItems = cleanupOldChatSessions(7 * 24 * 60 * 60 * 1000, 2, true);
    
    // If that wasn't enough, get even more aggressive
    if (cleanedItems === 0) {
      console.warn('Normal cleanup insufficient, performing aggressive cleanup...');
      
      // Get all localStorage keys
      const allKeys = Object.keys(localStorage);
      const chatKeys = allKeys.filter(key => 
        key.startsWith('chat_') || 
        key.includes('session') || 
        key.includes('message')
      );
      
      // Sort chat keys by estimated priority (keep active session, remove others)
      const activeSessionId = localStorage.getItem('active_session_id');
      
      // First remove all non-active session message history
      for (const key of chatKeys) {
        // Skip the active session
        if (activeSessionId && key.includes(activeSessionId)) {
          continue;
        }
        
        // Remove message history first as it's typically larger
        if (key.startsWith('chat_messages_')) {
          try {
            localStorage.removeItem(key);
            cleanedItems++;
          } catch (e) {
            console.error(`Failed to remove item ${key}:`, e);
          }
        }
      }
      
      // If we still need more space, remove session metadata except active session
      if (cleanedItems === 0) {
        for (const key of chatKeys) {
          // Skip the active session
          if (activeSessionId && key.includes(activeSessionId)) {
            continue;
          }
          
          // Remove session metadata
          if (key.startsWith('chat_session_')) {
            try {
              localStorage.removeItem(key);
              cleanedItems++;
            } catch (e) {
              console.error(`Failed to remove item ${key}:`, e);
            }
          }
        }
      }
      
      // Last resort - clear all localStorage except critical items
      if (cleanedItems === 0) {
        console.warn('Extreme cleanup needed - clearing most localStorage items');
        const criticalKeys = [
          'active_session_id', 
          'user_data', 
          'current_organization_id',
          'auth_token'
        ];
        
        // Preserve critical values
        const preserved: Record<string, string> = {};
        for (const key of criticalKeys) {
          const value = localStorage.getItem(key);
          if (value) {
            preserved[key] = value;
          }
        }
        
        // Clear localStorage
        localStorage.clear();
        cleanedItems = allKeys.length;
        
        // Restore critical values
        for (const [key, value] of Object.entries(preserved)) {
          localStorage.setItem(key, value);
        }
        
        console.log('Emergency cleanup complete - cleared localStorage and preserved critical data');
      }
    }
    
    return cleanedItems;
  } catch (error) {
    console.error('Failed during emergency cleanup:', error);
    return 0;
  }
} 