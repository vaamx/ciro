// Script to refresh the Knowledge Base
// This script dispatches a custom event that will trigger the KnowledgeProvider to refresh

// Function to refresh the Knowledge Base
function refreshKnowledgeBase(forceReload = false) {
  console.log('Dispatching knowledgeBaseUpdate event to refresh Knowledge Base');
  
  // Create and dispatch a custom event
  const event = new CustomEvent('knowledgeBaseUpdate', {
    detail: {
      // No specific source to delete or add, just trigger a refresh
    }
  });
  
  window.dispatchEvent(event);
  console.log('Event dispatched successfully');

  // If forceReload is true, reload the page after a short delay
  if (forceReload) {
    console.log('Force reload requested, reloading page in 1 second...');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }
}

// Export the function for use in other files
export { refreshKnowledgeBase };

// If this script is loaded directly in the browser, execute the refresh
if (typeof window !== 'undefined') {
  console.log('Executing Knowledge Base refresh');
  refreshKnowledgeBase();
} 