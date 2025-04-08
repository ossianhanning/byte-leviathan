/**
 * Keyboard navigation handler for HexViewer
 * Use as an action in Svelte
 */

import type { Selection } from './types';

interface KeyboardNavigationOptions {
  fileLength: number;
  bytesPerRow: number;
  scrollTop: number;
  setScrollTop: (scrollTop: number) => void;
  viewportHeight: number;
  rowHeight: number;
  selection: Selection | null;
  setSelection: (selection: Selection | null) => void;
  onSelectionChange?: ((selection: Selection | null) => void) | null;
}

export function keyboardNavigation(node: HTMLElement, options: KeyboardNavigationOptions) {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Skip if no selection is active
    if (!options.selection) return;
    
    // Determine if we're extending the selection with shift key
    const isExtendingSelection = e.shiftKey;
    const currentByte = isExtendingSelection ? options.selection.end : options.selection.start;
    let newByte: number | null = null;
    
    // Current position calculations
    const currentRow = Math.floor(currentByte / options.bytesPerRow);
    const currentCol = currentByte % options.bytesPerRow;
    
    // Calculate total dimensions
    const totalRows = Math.ceil(options.fileLength / options.bytesPerRow);
    const totalHeight = totalRows * options.rowHeight;
    const visibleRows = Math.floor(options.viewportHeight / options.rowHeight);
    
    switch (e.key) {
      case 'ArrowLeft':
        if (currentByte > 0) {
          newByte = currentByte - 1;
        }
        break;
        
      case 'ArrowRight':
        if (currentByte < options.fileLength - 1) {
          newByte = currentByte + 1;
        }
        break;
        
      case 'ArrowUp':
        if (currentRow > 0) {
          newByte = (currentRow - 1) * options.bytesPerRow + currentCol;
        }
        break;
        
      case 'ArrowDown':
        if ((currentRow + 1) * options.bytesPerRow + currentCol < options.fileLength) {
          newByte = (currentRow + 1) * options.bytesPerRow + currentCol;
        }
        break;
        
      case 'Home':
        if (e.ctrlKey || e.metaKey) {
          // Go to start of file
          newByte = 0;
        } else {
          // Go to start of row
          newByte = currentRow * options.bytesPerRow;
        }
        break;
        
      case 'End':
        if (e.ctrlKey || e.metaKey) {
          // Go to end of file
          newByte = options.fileLength - 1;
        } else {
          // Go to end of row
          newByte = Math.min(options.fileLength - 1, (currentRow + 1) * options.bytesPerRow - 1);
        }
        break;
        
      case 'PageUp':
        if (currentRow - visibleRows >= 0) {
          newByte = (currentRow - visibleRows) * options.bytesPerRow + currentCol;
        } else {
          // Go to first row
          newByte = currentCol;
        }
        break;
        
      case 'PageDown':
        if ((currentRow + visibleRows) * options.bytesPerRow + currentCol < options.fileLength) {
          newByte = (currentRow + visibleRows) * options.bytesPerRow + currentCol;
        } else {
          // Go to last row
          const lastRow = Math.floor((options.fileLength - 1) / options.bytesPerRow);
          newByte = Math.min(options.fileLength - 1, lastRow * options.bytesPerRow + currentCol);
        }
        break;
    }
    
    // If a valid new byte position was calculated
    if (newByte !== null) {
      // Ensure it's within file bounds
      newByte = Math.max(0, Math.min(options.fileLength - 1, newByte));
      
      // Create the new selection
      let newSelection: Selection;
      if (isExtendingSelection) {
        // When extending, keep the original start but update the end
        const start = options.selection.start;
        const end = newByte;
        const byteCount = Math.abs(end - start) + 1;
        // Preserve the selection type
        const selectionType = options.selection.selectionType;
        newSelection = { start, end, byteCount, selectionType };
      } else {
        // Without Shift, just select the single byte
        // Preserve the selection type
        const selectionType = options.selection.selectionType;
        newSelection = { start: newByte, end: newByte, byteCount: 1, selectionType };
      }
      
      options.setSelection(newSelection);
      if (options.onSelectionChange) {
        options.onSelectionChange(newSelection);
      }
      
      // Ensure the selected byte is visible by scrolling if necessary
      const newByteRow = Math.floor(newByte / options.bytesPerRow);
      const newByteTop = newByteRow * options.rowHeight;
      const newByteBottom = (newByteRow + 1) * options.rowHeight;
      
      // If the new position is above the visible area, scroll up
      if (newByteTop < options.scrollTop) {
        options.setScrollTop(newByteTop);
      }
      // If the new position is below the visible area, scroll down
      else if (newByteBottom > options.scrollTop + options.viewportHeight) {
        options.setScrollTop(Math.min(
          newByteBottom - options.viewportHeight, 
          totalHeight - options.viewportHeight
        ));
      }
      
      // Prevent default browser behavior for these keys
      e.preventDefault();
      e.stopPropagation();
    }
  };
  
  // Add keydown event listener
  window.addEventListener('keydown', handleKeyDown);
  
  return {
    update(newOptions: KeyboardNavigationOptions) {
      // Update options when they change
      Object.assign(options, newOptions);
    },
    destroy() {
      // Clean up the event listener when component unmounts
      window.removeEventListener('keydown', handleKeyDown);
    }
  };
}