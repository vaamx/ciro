/**
 * Utility for clipboard operations
 */

/**
 * Copy text to clipboard
 * @param text - The text to copy
 * @returns A boolean indicating success
 */
export function copyToClipboard(text: string): boolean {
  try {
    // Use the Clipboard API if available
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback method
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Make the textarea out of viewport
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    
    textArea.focus();
    textArea.select();
    
    // Copy the text
    const success = document.execCommand('copy');
    
    // Clean up
    document.body.removeChild(textArea);
    
    return success;
  } catch (error) {
    console.error('Failed to copy text:', error);
    return false;
  }
} 