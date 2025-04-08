<script lang="ts">
  import { onMount, tick, afterUpdate } from 'svelte';
  import { writable, derived, type Writable, get } from 'svelte/store';
  import { keyboardNavigation } from './KeyboardNavigation';
  import CustomScrollbar from './CustomScrollbar.svelte';
  import GoToAddress from './GoToAddress.svelte';
  import ContextMenu from './ContextMenu.svelte';
  import DataInspector from './DataInspector.svelte';
  import type { Tag, Selection } from './types';

  function cancelable<T>(promise: Promise<T>) {
    let canceled = false;

    const wrapped = new Promise<T>((resolve, reject) => {
        promise.then(
            val => canceled ? undefined : resolve(val),
            err => canceled ? undefined : reject(err)
        );
    });

    return {
        promise: wrapped,
        cancel: () => (canceled = true)
    };
  }

  export let fileLength: number = 0;
  export let onRequestData: (start: number, end: number) => Promise<Uint8Array>;
  export let onSelectionChange: ((selection: Selection | null) => void) | null = null;
  export let tags: Tag[] = [];

  const BYTES_PER_ROW = 16;
  const ROW_HEIGHT = 24;

  let container: HTMLElement;
  let contentContainer: HTMLElement;

  const viewportHeight: Writable<number> = writable(0);
  const scrollPosition: Writable<number> = writable(0);

  type RowData = {
    bytes: Uint8Array;
    status: 'loading' | 'loaded';
  };

  type Cancelable<T> = ReturnType<typeof cancelable<T>>;
  let pendingRequest: Cancelable<RowData[]> | null = null;

  let currentVisibleRowData : Writable<RowData[]> = writable([]);
  const totalRows = Math.ceil(fileLength / BYTES_PER_ROW);
  const totalHeight = totalRows * ROW_HEIGHT;

  let isGotoDialogVisible = false;
  let isContextMenuVisible = false;
  let contextMenuX = 0;
  let contextMenuY = 0;
  let toastVisible = false;
  let toastMessage = '';
  let toastType: 'info' | 'success' | 'error' = 'info';
  let toastTimer: number | null = null;

  function calculateVisibleRows(scrollPos: number, height: number) {
    const firstVisibleRow = Math.max(0, Math.floor(scrollPos / ROW_HEIGHT));
    const rowsInViewport = Math.ceil(height / ROW_HEIGHT);
    const lastVisibleRow = Math.min(firstVisibleRow + rowsInViewport, totalRows - 1);
    const visibleRows = Array.from(
      { length: lastVisibleRow - firstVisibleRow + 1 },
      (_, i) => firstVisibleRow + i
    );

    return {
      firstVisibleRow,
      lastVisibleRow,
      visibleRows,
      rowsInViewport
    };
  }

  function loadVisibleData(scrollPos: number, height: number) {
    const { firstVisibleRow, lastVisibleRow, visibleRows } = calculateVisibleRows(scrollPos, height);
    
    if(visibleRows.length > 0) {
      currentVisibleRowData.set(visibleRows.map(rowIndex => ({ bytes: new Uint8Array(BYTES_PER_ROW), status: 'loading' })));
      requestDataForRows(firstVisibleRow, lastVisibleRow);
    }
  }

  function forceRefresh() {
    loadVisibleData($scrollPosition, $viewportHeight);
  }

  const visibleRowsInfo = derived(
    [scrollPosition, viewportHeight], 
    ([$scrollPosition, $viewportHeight]) => {
      const rowsInfo = calculateVisibleRows($scrollPosition, $viewportHeight);
      loadVisibleData($scrollPosition, $viewportHeight);
      
      return rowsInfo;
    }
  );

  let selection: Writable<Selection | null> = writable(null);
  let isSelecting = false;
  let selectedBytes = new Set<number>();
  let selectionType: 'bytes' | 'text' = 'bytes';
  let tagsByByteIndex = new Map<number, Tag>();

  $: keyboardNavParams = {
    fileLength,
    bytesPerRow: BYTES_PER_ROW,
    scrollTop: $scrollPosition,
    setScrollTop: (value: number) => scrollPosition.set(value),
    viewportHeight: $viewportHeight,
    rowHeight: ROW_HEIGHT,
    selection: $selection,
    setSelection: (newSelection: Selection | null) => {
      selection.set(newSelection);
    },
    onSelectionChange
  }
  $: {
    tagsByByteIndex = new Map<number, Tag>();
    tags.forEach(tag => {
      for (let i = tag.start; i <= tag.end; i++) {
        tagsByByteIndex.set(i, tag);
      }
    });
  }
  $: if ($selection) {
    selectedBytes = new Set<number>();
      let { start, end } = $selection;
      if(end < start) {
        [start, end] = [end, start];
      }
    for (let i = start; i <= end; i++) {
      selectedBytes.add(i);
    }
  } else {
    selectedBytes = new Set<number>();
  }
  onMount(() => {
    const observer = new ResizeObserver(async () => {
      if (container) {
        const headerHeight = container.querySelector('.header')?.clientHeight || 0;
        const selectionHeight = container.querySelector('.selection-info')?.clientHeight || 0;
        const newHeight = container.clientHeight - headerHeight - selectionHeight - 10;
        
        if (newHeight !== $viewportHeight) {
          viewportHeight.set(newHeight);
        }
      }
    });
    
    if (container) {
      observer.observe(container);
    }
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    return () => {
      observer.disconnect();
      document.removeEventListener('keydown', handleKeyboardShortcuts);
    };
  });

  function requestDataForRows(startRow: number, endRow: number): void {
    const startByte = startRow * BYTES_PER_ROW;
    const endByte = Math.min(fileLength, (endRow + 1) * BYTES_PER_ROW);

    if(pendingRequest) {
      pendingRequest.cancel(); // Cancel previous request if any
    }
    
    pendingRequest = cancelable(fetchData(startByte, endByte));
    pendingRequest.promise.then(rowdata => {
      currentVisibleRowData.set(rowdata);
      if (pendingRequest) {
        pendingRequest = null;
      }
    });
  }
  
  async function fetchData(startByte: number, endByte: number): Promise<RowData[]> {
      console.debug(`Requesting data from ${startByte} to ${endByte}`);
      const data = await onRequestData(startByte, endByte);
      const startRow = Math.floor(startByte / BYTES_PER_ROW);
      const endRow = Math.ceil(endByte / BYTES_PER_ROW) - 1;

      let newCurrentVisibleRowData = [];
      for (let rowIndex = startRow; rowIndex <= endRow; rowIndex++) {
        const rowStartByte = rowIndex * BYTES_PER_ROW;
        const offsetInData = rowStartByte - startByte;
        if (offsetInData < 0 || offsetInData >= data.length) continue;
        
        const bytesForRow = Math.min(BYTES_PER_ROW, data.length - offsetInData);
        if (bytesForRow <= 0) continue;
        
        const rowBytes = new Uint8Array(BYTES_PER_ROW);
        rowBytes.set(data.slice(offsetInData, offsetInData + bytesForRow));

        const rowData: RowData = {
          bytes: rowBytes,
          status: 'loaded'
        };

        newCurrentVisibleRowData[rowIndex] = rowData;
      }

      return newCurrentVisibleRowData;
  }

  function getByte(byteIndex: number): number | null {
    if (byteIndex >= fileLength) return null;
    
    const rowIndex = Math.floor(byteIndex / BYTES_PER_ROW);
    const byteOffset = byteIndex % BYTES_PER_ROW;

    const rowData = $currentVisibleRowData[rowIndex];
    if (rowData && rowData.status === 'loaded') {
      return rowData.bytes[byteOffset] ?? null;
    }

    return null;
  }

  function getBytesForInspector(start: number, length: number): Uint8Array | null {
    if (start >= fileLength) return null;
    
    const bytes = new Uint8Array(length);
    let allValid = true;
    
    for (let i = 0; i < length && (start + i) < fileLength; i++) {
      const byte = getByte(start + i);
      if (byte === null) {
        allValid = false;
        break;
      }
      bytes[i] = byte;
    }
    
    return allValid ? bytes : null;
  }

  function byteToHex(byte: number | null): string {
    if (byte === null) return '..';
    return byte.toString(16).toUpperCase().padStart(2, '0');
  }
  
  function byteToChar(byte: number | null): string {
    if (byte === null) return '.';
    return byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';
  }
  
  function getByteColorClass(byte: number | null): string {
    if (byte === null) return 'loading';
    if (byte === 0) return 'zero';
    if (byte === 0xFF) return 'ff-byte';
    if (byte >= 0xE0) return 'high-byte';
    if (byte <= 0x1F) return 'low-byte';
    return '';
  }
  
  function startSelection(byteIndex: number, isTextSelection: boolean = false, event: MouseEvent | void): void {
    if(event && event.buttons !== 1) {
      return;
    }
    
    isSelecting = true;
    selectionType = isTextSelection ? 'text' : 'bytes';
    selection.set({ 
      start: byteIndex, 
      end: byteIndex, 
      byteCount: 1, 
      selectionType 
    });
    onSelectionChange?.($selection);
  }
  
  function updateSelection(byteIndex: number, event: MouseEvent | void): void {
    if(!isSelecting || (event && event.buttons !== 1)) {
      isSelecting = false;
      return;
    }

    let sel = get(selection);
    if (!sel) return;

    sel.end = byteIndex;
    sel.byteCount = Math.abs(sel.end - sel.start) + 1;
    sel.selectionType = selectionType;
    
    selection.set(sel);
    onSelectionChange?.(sel);
  }
  
  function endSelection(): void {
    if (!isSelecting) return;
    isSelecting = false;
  }
  
  async function handleAddressClick(rowIndex: number): Promise<void> {
    const address = rowIndex * BYTES_PER_ROW;
    const hexAddress = '0x' + address.toString(16).toUpperCase();
    
    try {
      await navigator.clipboard.writeText(hexAddress);
      showToast(`Address ${hexAddress} copied to clipboard`, 'success');
    } catch (error) {
      console.error("Error copying address to clipboard:", error);
      showToast("Failed to copy address to clipboard", 'error');
    }
  }
  
  function handleContextMenu(e: MouseEvent): void {
    e.preventDefault();
    
    if ($selection) {
      contextMenuX = e.clientX;
      contextMenuY = e.clientY;
      isContextMenuVisible = true;
    }
  }
  
  function closeContextMenu(): void {
    isContextMenuVisible = false;
  }
  
  async function copySelectionToClipboard(): Promise<void> {
    const sel = $selection;
    if (!sel) return;
    
    try {
      let start = Math.min(sel.start, sel.end);
      let end = Math.max(sel.start, sel.end);
      
      start = Math.max(0, Math.min(start, fileLength - 1));
      end = Math.max(0, Math.min(end, fileLength - 1));
      
      const firstVisibleByte = $visibleRowsInfo.firstVisibleRow * BYTES_PER_ROW;
      const lastVisibleByte = Math.min(
        ($visibleRowsInfo.lastVisibleRow + 1) * BYTES_PER_ROW - 1,
        fileLength - 1
      );
      
      if (start < firstVisibleByte || end > lastVisibleByte) {
        showToast("Cannot copy: selection not entirely visible. Scroll to view selection fully.", 'error');
        return;
      }
      
      if (sel.selectionType === 'bytes') {
        let hexValues = [];
        for (let i = start; i <= end; i++) {
          const byte = getByte(i);
          if (byte !== null) {
            hexValues.push(byteToHex(byte));
          } else {
            showToast("Cannot copy: data not fully loaded", 'error');
            return;
          }
        }
        await navigator.clipboard.writeText(hexValues.join(' '));
        showToast("Hex values copied to clipboard", 'success');
      } else {
        let textValues = [];
        for (let i = start; i <= end; i++) {
          const byte = getByte(i);
          if (byte !== null) {
            textValues.push(byteToChar(byte));
          } else {
            showToast("Cannot copy: data not fully loaded", 'error');
            return;
          }
        }
        await navigator.clipboard.writeText(textValues.join(''));
        showToast("Text copied to clipboard", 'success');
      }
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      showToast("Failed to copy to clipboard", 'error');
    }
  }
  
  function navigateToAddress(address: number): void {
    const rowIndex = Math.floor(address / BYTES_PER_ROW);
    const newScrollPosition = rowIndex * ROW_HEIGHT;
    scrollPosition.set(Math.max(0, Math.min(newScrollPosition, totalHeight - $viewportHeight)));
  }
  
  function showToast(message: string, type: 'info' | 'success' | 'error' = 'info', duration: number = 3000): void {
    if (toastTimer !== null) {
      clearTimeout(toastTimer);
    }
    
    toastMessage = message;
    toastType = type;
    toastVisible = true;
    
    toastTimer = window.setTimeout(() => {
      toastVisible = false;
      toastTimer = null;
    }, duration);
  }
  
  function handleKeyboardShortcuts(e: KeyboardEvent): void {
    if (e.key === 'g' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      isGotoDialogVisible = true;
    }
    
    if (e.key === 'c' && (e.ctrlKey || e.metaKey) && $selection) {
      e.preventDefault();
      copySelectionToClipboard();
    }
  }
  
  function handleWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 3 : e.deltaY < 0 ? -3 : 0;
    const newRow = Math.floor($scrollPosition / ROW_HEIGHT) + delta;
    const newScrollPosition = Math.max(0, Math.min(newRow * ROW_HEIGHT, totalHeight - $viewportHeight));
    scrollPosition.set(newScrollPosition);
  }
  
  function handleScroll(e: CustomEvent<number>): void {
    const newScrollPosition = Math.max(0, Math.min(totalHeight - $viewportHeight, e.detail));
    const rowPosition = Math.floor(newScrollPosition / ROW_HEIGHT) * ROW_HEIGHT;
    scrollPosition.set(rowPosition);
  }
</script>

<svelte:window on:load={forceRefresh} />

<div class="hex-viewer" bind:this={container} use:keyboardNavigation={keyboardNavParams}>
  <div class="viewer-container">
    <div class="header">
      <div class="address-col">Address</div>
      <div class="bytes-cols">
        {#each Array(BYTES_PER_ROW) as _, i}
          <div class="byte-header" class:spacer={i === 7}>
            {i.toString(16).toUpperCase()}
          </div>
        {/each}
      </div>
      <div class="ascii-col">ASCII</div>
      <div class="tools">
        <button class="tool-button" on:click={() => isGotoDialogVisible = true} title="Go to Address (Ctrl+G)">
          <span class="tooltip">Go to Address</span>
          <span class="tool-icon">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5M12,2A7,7 0 0,0 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9A7,7 0 0,0 12,2Z" />
            </svg>
          </span>
        </button>
      </div>
    </div>
    
    <div 
      class="content-container" 
      bind:this={contentContainer}
      style="height: {$viewportHeight}px;"
      on:wheel={handleWheel}
      on:contextmenu={handleContextMenu}
      role="grid"
      tabindex="0"
    >
      <!-- Fixed rows that just update content -->
      <div class="content">
        {#if $visibleRowsInfo.visibleRows.length > 0}
          {#each $visibleRowsInfo.visibleRows as rowIndex, displayIndex}
            <div 
              class="row" 
              class:even={rowIndex % 2 === 0}
              style="top: {(rowIndex - $visibleRowsInfo.firstVisibleRow) * ROW_HEIGHT}px;"
            >            <div class="address-col" 
                 on:click={() => handleAddressClick(rowIndex)} 
                 on:keydown={(e) => e.key === 'Enter' && handleAddressClick(rowIndex)}
                 role="button" 
                 tabindex="0">
              <span class="address-value">
                {(rowIndex * BYTES_PER_ROW).toString(16).padStart(8, '0').toUpperCase()}
              </span>
            </div>
            
            <div class="bytes-cols">
              {#each Array(BYTES_PER_ROW) as _, byteOffset}
                {@const byteIndex = rowIndex * BYTES_PER_ROW + byteOffset}
                {@const byte = byteIndex < fileLength ? getByte(byteIndex) : null}
                {@const isSelected = selectedBytes.has(byteIndex)}
                {@const tag = tagsByByteIndex.get(byteIndex)}
                {@const colorClass = getByteColorClass(byte)}
                
                <div class="byte" 
                     class:selected={isSelected && $selection?.selectionType === 'bytes'}
                     class:selected-secondary={isSelected && $selection?.selectionType !== 'bytes'}
                     class:tagged={tag}
                     class:zero={colorClass === 'zero'}
                     class:ff-byte={colorClass === 'ff-byte'}
                     class:high-byte={colorClass === 'high-byte'}
                     class:low-byte={colorClass === 'low-byte'}
                     class:loading={byte === null && byteIndex < fileLength}
                     class:spacer={byteOffset === 7}
                     style={tag?.color ? `background-color: ${tag.color}` : ''}
                     on:mousedown={e => startSelection(byteIndex, false, e)}
                     on:focus={() => startSelection(byteIndex, false)}
                     on:mouseover={e => updateSelection(byteIndex, e)}
                     on:mouseup={endSelection}
                     title={tag?.displayName || ''}
                     role="button"
                     tabindex="0">
                  {byteToHex(byte)}
                </div>
              {/each}
            </div>
            
            <div class="ascii-col">
              {#each Array(BYTES_PER_ROW) as _, byteOffset}
                {@const byteIndex = rowIndex * BYTES_PER_ROW + byteOffset}
                {@const byte = byteIndex < fileLength ? getByte(byteIndex) : null}
                {@const isSelected = selectedBytes.has(byteIndex)}
                {@const tag = tagsByByteIndex.get(byteIndex)}
                {@const colorClass = getByteColorClass(byte)}
                
                <div class="ascii-char" 
                     class:selected={isSelected && $selection?.selectionType === 'text'}
                     class:selected-secondary={isSelected && $selection?.selectionType !== 'text'}
                     class:tagged={tag}
                     class:zero={colorClass === 'zero'}
                     class:ff-byte={colorClass === 'ff-byte'}
                     class:high-byte={colorClass === 'high-byte'}
                     class:low-byte={colorClass === 'low-byte'}
                     class:loading={byte === null && byteIndex < fileLength}
                     style={tag?.color ? `background-color: ${tag.color}` : ''}
                     on:mousedown={e => startSelection(byteIndex, true, e)}
                     on:mouseover={e => updateSelection(byteIndex, e)}
                     on:focus={() => startSelection(byteIndex, true)}
                     on:mouseup={endSelection}
                     role="button"
                     tabindex="0">
                  {byteToChar(byte)}
                </div>
              {/each}
            </div>
          </div>
          {/each}
        {/if}
      </div>
      
      <!-- Custom scrollbar -->
      <CustomScrollbar 
        contentHeight={totalHeight}
        viewportHeight={$viewportHeight}
        scrollTop={$scrollPosition}
        on:scroll={handleScroll}
      />
    </div>
    
    <div class="selection-info">
      {#if $selection}
        <div class="selection-badge">
          <span class="selection-address">0x{$selection?.start.toString(16).toUpperCase()} - 0x{$selection.end.toString(16).toUpperCase()}</span>
          <span class="selection-size">(0x{$selection.byteCount.toString(16).toUpperCase()} | {$selection.byteCount} bytes)</span>
          <span class="selection-type">{$selection.selectionType === 'bytes' ? 'HEX' : 'TEXT'}</span>
        </div>
      {:else}
        <span class="no-selection">No selection</span>
      {/if}
    </div>
  </div>
  
  <!-- Data Inspector Container -->
  <div class="inspector-container">
    <DataInspector 
      selection={$selection}
      getBytes={getBytesForInspector}
    />
  </div>
</div>

<!-- Go to address dialog -->
<GoToAddress 
  bind:visible={isGotoDialogVisible}
  on:navigate={e => navigateToAddress(e.detail)}
  on:close={() => isGotoDialogVisible = false}
/>

<!-- Context menu -->
<ContextMenu 
  bind:visible={isContextMenuVisible}
  x={contextMenuX}
  y={contextMenuY}
  selectionExists={$selection !== null}
  on:copy={copySelectionToClipboard}
  on:close={closeContextMenu}
/>

<!-- Toast notification -->
{#if toastVisible}
  <div class="toast-notification" class:toast-success={toastType === 'success'} class:toast-error={toastType === 'error'}>
    <span class="toast-icon">
      {#if toastType === 'success'}✓{:else if toastType === 'error'}✕{:else}ℹ{/if}
    </span>
    <span class="toast-message">{toastMessage}</span>
  </div>
{/if}

<style>
.hex-viewer {
  font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Consolas', monospace;
  display: flex;
  flex-direction: row;
  height: 100%;
  background: linear-gradient(135deg, #171b29 0%, #1f2438 100%);
  color: #e4e9f5;
  user-select: none;
  overflow: hidden;
  contain: content;
}

.viewer-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  height: 100%;
}

.inspector-container {
  width: 430px;
  min-width: 430px;
  margin-left: 2px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 0;
  height: 100%;
  background: linear-gradient(135deg, #1c2133 0%, #232942 100%);
  border-left: 1px solid #2a3550;
}

.selection-info {
  padding: 10px 14px;
  background: linear-gradient(90deg, #1d2236 0%, #232942 100%);
  border-top: 1px solid #2a3550;
  font-size: 13px;
  color: #b8c4e2;
  flex-shrink: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  height: 20px;
}

.selection-badge {
  display: inline-flex;
  align-items: center;
  column-gap: 10px;
}

.selection-address {
  color: #60b8ff;
  font-weight: 500;
}

.selection-size {
  color: #60c689;
}

.selection-type {
  background: linear-gradient(180deg, #3055b5 0%, #1f3c82 100%);
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.no-selection {
  color: #6c7a9c;
  font-style: italic;
}

.header {
  display: flex;
  padding: 12px 0;
  border-bottom: 1px solid #2a3550;
  background: linear-gradient(90deg, #1d2236 0%, #232942 100%);
  z-index: 10;
  font-weight: 500;
  font-size: 13px;
  color: #60b8ff;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  height: 22px;
}

.tools {
  margin-left: auto;
  display: flex;
  align-items: center;
  padding-right: 16px;
}

.tool-button {
  position: relative;
  background: none;
  border: none;
  color: #b8c4e2;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tool-button:hover {
  background-color: rgba(96, 184, 255, 0.1);
  color: #60b8ff;
}

.tool-button:active {
  background-color: rgba(96, 184, 255, 0.2);
  transform: translateY(1px);
}

.tool-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.tooltip {
  position: absolute;
  bottom: -32px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #2a3550;
  color: white;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s ease;
  pointer-events: none;
  z-index: 1000;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
}

.tool-button:hover .tooltip {
  opacity: 1;
  visibility: visible;
  bottom: -36px;
}

.content-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  contain: strict;
}

.content {
  position: absolute;
  top: 0;
  left: 0;
  right: 12px;
  bottom: 0;
  overflow: hidden;
  contain: strict;
}

.row {
  position: absolute;
  left: 0;
  right: 0;
  height: 24px;
  display: flex;
  align-items: center;
  font-size: 14px;
  contain: content;
  transition: background-color 0.2s ease;
}

.row.even {
  background-color: rgba(24, 29, 48, 0.7);
}

.row:not(.even) {
  background-color: rgba(27, 33, 54, 0.7);
}

.row:hover {
  background-color: rgba(48, 59, 94, 0.5);
}

.address-col {
  width: 90px;
  padding-left: 14px;
  color: #60b8ff;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  height: 100%;
  position: relative;
  border-right: 1px solid rgba(96, 184, 255, 0.1);
}

.address-col:hover {
  background-color: rgba(96, 184, 255, 0.1);
}

.address-col:active {
  background-color: rgba(96, 184, 255, 0.2);
}

.address-col:hover::after {
  content: "Copy";
  position: absolute;
  right: 8px;
  font-size: 10px;
  color: #60b8ff;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  opacity: 0.7;
}

.bytes-cols {
  display: flex;
  border-right: 1px solid rgba(96, 184, 255, 0.1);
}

.byte, .byte-header {
  width: 24px;
  text-align: center;
  height: 22px;
  line-height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.byte {
  border-radius: 3px;
  margin: 0 1px;
}

.bytes-cols {
  height: 100%;
  display: flex;
  align-items: center;
}
  
.ascii-col {
  width: 130px;
  padding-left: 14px;
  display: flex;
  height: 100%;
  align-items: center;
}

.ascii-char {
  width: 8px;
  height: 20px;
  text-align: center;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
}

.spacer {
  margin-right: 14px;
}

/* Byte value styling */
.zero {
  color: #576280; /* Faded for zeros */
}

.ff-byte {
  color: #f28779; /* Red shade for FF values */
  font-weight: 500;
}

.high-byte {
  color: #ffa344; /* Orange shade for high values */
}

.low-byte {
  color: #78b4ff; /* Blue shade for low values */
}

.loading {
  color: #576280;
  opacity: 0.5;
}

.selected {
  background-color: rgba(96, 184, 255, 0.3);
  color: white !important;
  box-shadow: 0 0 8px rgba(96, 184, 255, 0.5);
  z-index: 5;
}

.selected-secondary {
  background-color: rgba(96, 184, 255, 0.15);
  color: #e4e9f5 !important;
}

.tagged {
  position: relative;
  z-index: 2;
}

.tagged::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background-color: inherit;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.5);
}

.byte:hover:not(.selected),
.ascii-char:hover:not(.selected) {
  background-color: rgba(96, 184, 255, 0.07);
  transform: translateY(-1px);
}

.toast-notification {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(31, 39, 64, 0.95);
  color: #e4e9f5;
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 14px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
  z-index: 1100;
  transition: all 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  min-width: 220px;
  max-width: 400px;
  border: 1px solid rgba(96, 184, 255, 0.1);
  animation: toastFadeIn 0.3s ease;
}

@keyframes toastFadeIn {
  from {
    opacity: 0;
    transform: translate(-50%, 20px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

.toast-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.1);
  font-size: 14px;
}

.toast-success {
  background: linear-gradient(90deg, rgba(31, 39, 64, 0.95) 0%, rgba(35, 48, 75, 0.95) 100%);
  border-left: 3px solid #60c689;
}

.toast-success .toast-icon {
  color: #60c689;
}

.toast-error {
  background: linear-gradient(90deg, rgba(44, 31, 31, 0.95) 0%, rgba(65, 35, 35, 0.95) 100%);
  border-left: 3px solid #f28779;
}

.toast-error .toast-icon {
  color: #f28779;
}

.toast-message {
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>