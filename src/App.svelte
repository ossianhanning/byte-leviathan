<script lang="ts">
  import HexViewer from './HexViewer.svelte';
  import type { Tag, Selection } from './types';
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-dialog';

  let fileLength: number = 0;
  let filePath: string | null = null;
  let tags: Tag[] = [];
  let isFileLoaded: boolean = false;
  let isLoading: boolean = false;
  let error: string | null = null;

  async function openFileDialog() {
    try {

      const selected = await open({
        multiple: false,
        directory: false,
      });
      
      if (selected) {
        loadFile(selected);
      }
    } catch (err) {
      console.error('Failed to open file dialog:', err);
      error = typeof err === 'string' ? err : 'Failed to open file dialog';
    }
  }

  async function loadFile(path: string) {
    try {
      isLoading = true;
      error = null;

      const length = await invoke<number>('open_file', { path });
      
      filePath = path;
      fileLength = length;
      isFileLoaded = true;

      const initialTags = await loadTags(0, Math.min(16384, length));
      tags = initialTags;
    } catch (err) {
      console.error('Failed to open file:', err);
      error = typeof err === 'string' ? err : 'Failed to open file';
      isFileLoaded = false;
    } finally {
      isLoading = false;
    }
  }

  async function handleRequestData(start: number, end: number): Promise<Uint8Array> {
    try {

      const data = await invoke<number[]>('get_file_data', { start, end });

      return new Uint8Array(data);
    } catch (error) {
      console.error(`Failed to load data for range ${start}-${end}:`, error);
      throw error;
    }
  }

  async function handleSelectionChange(selection: Selection | null): Promise<void> {
    if (!selection) return;
    
    try {

      const start = Math.min(selection.start, selection.end);
      const end = Math.max(selection.start, selection.end);

      const selectionTags = await loadTags(start, end);

      tags = [
        ...tags.filter(tag => tag.end < start || tag.start > end),
        ...selectionTags
      ];
    } catch (error) {
      console.error('Error loading tags for selection:', error);
    }
  }

  async function loadTags(start: number, end: number): Promise<Tag[]> {
    try {
      return await invoke<Tag[]>('get_tags_in_range', { start, end });
    } catch (error) {
      console.error('Failed to load tags:', error);
      return [];
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 bytes';
    
    const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
    const base = 1024;

    const unitIndex = Math.floor(Math.log(bytes) / Math.log(base));

    const normalizedUnitIndex = Math.min(unitIndex, units.length - 1);

    const size = bytes / Math.pow(base, normalizedUnitIndex);




    let decimals = 2;
    
    if (normalizedUnitIndex === 0) {

      decimals = 0;
    } else if (normalizedUnitIndex === 1) {

      decimals = size >= 10 ? 0 : 1;
    } else {

      decimals = size >= 100 ? 1 : 2;
    }

    return size.toLocaleString('en-US', {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals
    }) + ' ' + units[normalizedUnitIndex];
  }

  function getFileName(path: string | null): string {
    if (!path) return 'No File';

    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1];
  }
</script>

<main class="app-container">
  <div data-tauri-drag-region class="header">
    <div class="logo-container">
      <div class="logo-icon">⬢</div>
      <h1 class="app-title">ByteLeviathan</h1>
      <div class="tagline">Massive File Hex Viewer</div>
    </div>
    
    <div class="file-info">
      {#if filePath}
        <span class="filename">{getFileName(filePath)}</span>
      {/if}
      {#if fileLength > 0}
        <span class="filesize">({formatFileSize(fileLength)})</span>
      {/if}
    </div>
    
    <button class="open-button" on:click={openFileDialog}>
      <span class="button-icon">📂</span>
      <span class="button-text">Open File</span>
    </button>
  </div>
  
  {#if error}
    <div class="error-message">
      <span class="error-icon">⚠️</span>
      <span>{error}</span>
      <button class="error-close" on:click={() => error = null}>×</button>
    </div>
  {/if}
  
  <div class="hex-viewer-wrapper">
    {#if isFileLoaded}
      <HexViewer
        {fileLength}
        onRequestData={handleRequestData}
        onSelectionChange={handleSelectionChange}
        {tags}
      />
    {:else if isLoading}
      <div class="loading-indicator">
        <div class="spinner"></div>
        <span>Loading file...</span>
      </div>
    {:else}
      <div class="no-file">
        <div class="no-file-icon">
          <svg viewBox="0 0 24 24" width="120" height="120">
            <path fill="currentColor" d="M4 20V4h16v16H4zM6 6v12h12V6H6zm3 9h6v-1H9v1zm0-3h6v-1H9v1zm0-3h6V8H9v1z"/>
          </svg>
        </div>
        <p>No file loaded. Open a file to begin analysis.</p>
        <button class="open-button-large pulse" on:click={openFileDialog}>
          <span class="button-icon">📂</span>
          <span class="button-text">Open File</span>
        </button>
      </div>
    {/if}
  </div>
</main>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700&family=Inter:wght@400;500;600&family=Fira+Code:wght@400;500&display=swap');
  
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background-color: #151821;
    color: #e4e9f5;
    overflow: hidden;
  }
  
  :global(button) {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  
  .app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: linear-gradient(135deg, #151821 0%, #1a1f2e 100%);
    color: #e4e9f5;
  }

  .header {
    display: flex;
    align-items: center;
    padding: 12px 22px;
    background: linear-gradient(90deg, #1c2130 0%, #1f2740 100%);
    border-bottom: 1px solid #2a3550;
    height: 64px;
    box-sizing: border-box;
    cursor: grab;
    user-select: none;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
  }
  
  .header > * {
    pointer-events: none;
  }
  
  .logo-container {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .logo-icon {
    font-size: 24px;
    color: #60b8ff;
    text-shadow: 0 0 10px rgba(96, 184, 255, 0.7);
  }
  
  .app-title {
    font-family: 'Orbitron', sans-serif;
    font-weight: 700;
    font-size: 22px;
    margin: 0;
    padding: 0;
    background: linear-gradient(to right, #60b8ff, #ae8fff);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-shadow: 0 0 15px rgba(96, 184, 255, 0.3);
    letter-spacing: 0.5px;
  }
  
  .tagline {
    font-size: 12px;
    color: #8597b9;
    margin-left: 4px;
    padding-top: 3px;
  }

  .file-info {
    display: flex;
    align-items: center;
    margin-left: 24px;
    flex: 1;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    background: rgba(30, 37, 59, 0.4);
    border-radius: 6px;
    padding: 6px 12px;
    border: 1px solid rgba(96, 184, 255, 0.1);
  }

  .filename {
    font-weight: 600;
    margin-right: 8px;
    color: #adc2ff;
  }

  .filesize {
    color: #60c689;
    font-size: 0.9rem;
  }
  
  .open-button {
    background: linear-gradient(180deg, #3055b5 0%, #1f3c82 100%);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-left: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 2px 8px rgba(21, 45, 102, 0.5);
    pointer-events: all;
  }

  .open-button:hover {
    background: linear-gradient(180deg, #3866d6 0%, #264da5 100%);
    box-shadow: 0 4px 12px rgba(21, 45, 102, 0.7);
  }
  
  .open-button:active {
    transform: translateY(1px);
    box-shadow: 0 1px 3px rgba(21, 45, 102, 0.7);
  }
  
  .button-icon {
    font-size: 16px;
  }

  .error-message {
    background: linear-gradient(90deg, #541a1a 0%, #611f1f 100%);
    color: white;
    padding: 12px 16px;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 10px;
    animation: slideDown 0.3s ease-out;
    border-bottom: 1px solid #7e2a2a;
  }
  
  .error-icon {
    font-size: 18px;
  }
  
  .error-close {
    margin-left: auto;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    font-size: 20px;
    cursor: pointer;
    padding: 0 5px;
  }
  
  .error-close:hover {
    color: rgba(255, 255, 255, 1);
  }

  .hex-viewer-wrapper {
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  .loading-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 1.1rem;
    color: #8597b9;
    flex-direction: column;
    gap: 20px;
  }
  
  .spinner {
    width: 50px;
    height: 50px;
    border: 4px solid rgba(96, 184, 255, 0.1);
    border-radius: 50%;
    border-top-color: #60b8ff;
    animation: spin 1s cubic-bezier(0.6, 0.2, 0.4, 0.8) infinite;
    box-shadow: 0 0 15px rgba(96, 184, 255, 0.3);
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .no-file {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #8597b9;
    text-align: center;
    padding: 0 20px;
    background: radial-gradient(circle at center, rgba(30, 37, 59, 0.4) 0%, rgba(21, 24, 33, 0) 70%);
  }
  
  .no-file-icon {
    font-size: 64px;
    margin-bottom: 20px;
    opacity: 0.7;
    color: #60b8ff;
  }
  
  .no-file p {
    margin-bottom: 32px;
    font-size: 1.1rem;
    max-width: 400px;
  }
  
  .open-button-large {
    background: linear-gradient(180deg, #3055b5 0%, #1f3c82 100%);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 2px 15px rgba(48, 85, 181, 0.5);
  }
  
  .open-button-large:hover {
    background: linear-gradient(180deg, #3866d6 0%, #264da5 100%);
    box-shadow: 0 4px 20px rgba(48, 85, 181, 0.7);
  }
  
  .open-button-large:active {
    transform: translateY(2px);
    box-shadow: 0 1px 5px rgba(48, 85, 181, 0.7);
  }
  
  .pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 2px 15px rgba(48, 85, 181, 0.5);
    }
    50% {
      transform: scale(1.03);
      box-shadow: 0 5px 25px rgba(48, 85, 181, 0.7);
    }
  }
  
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>