<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  export let visible: boolean = false;
  export let x: number = 0;
  export let y: number = 0;
  export let selectionExists: boolean = false;

  const dispatch = createEventDispatcher<{
    copy: void;
    close: void;
  }>();

  function handleClickOutside(event: MouseEvent) {
    if (visible) {
      dispatch('close');
    }
  }

  function handleCopy() {
    dispatch('copy');
    dispatch('close');
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && visible) {
      dispatch('close');
    } else if (event.key === 'c' && event.ctrlKey && visible && selectionExists) {
      handleCopy();
    }
  }
  
  onMount(() => {

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {

      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  });
</script>

{#if visible}
  <div 
    class="context-menu" 
    style="left: {x}px; top: {Math.max(0, y-35)}px;"
    on:click|stopPropagation
    on:keydown={(e) => {
      if (e.key === 'Escape') {
        dispatch('close');
      }
    }}
    role="menu"
    tabindex="-1"
  >
    <button 
      class="menu-item"
      class:disabled={!selectionExists}
      on:click={selectionExists ? handleCopy : null}
    >
      <span class="menu-icon">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z" />
        </svg>
      </span>
      <span class="menu-text">Copy</span>
      <span class="shortcut">Ctrl+C</span>
    </button>
    
    <div class="menu-divider"></div>
    
    <button class="menu-item">
      <span class="menu-icon">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M5,3H7V5H5V10A2,2 0 0,1 3,12A2,2 0 0,1 5,14V19H7V21H5C3.93,20.73 3,20.1 3,19V15A2,2 0 0,0 1,13H0V11H1A2,2 0 0,0 3,9V5A2,2 0 0,1 5,3M19,3A2,2 0 0,1 21,5V9A2,2 0 0,0 23,11H24V13H23A2,2 0 0,0 21,15V19A2,2 0 0,1 19,21H17V19H19V14A2,2 0 0,1 21,12A2,2 0 0,1 19,10V5H17V3H19M12,15A1,1 0 0,1 13,16A1,1 0 0,1 12,17A1,1 0 0,1 11,16A1,1 0 0,1 12,15M8,15A1,1 0 0,1 9,16A1,1 0 0,1 8,17A1,1 0 0,1 7,16A1,1 0 0,1 8,15M16,15A1,1 0 0,1 17,16A1,1 0 0,1 16,17A1,1 0 0,1 15,16A1,1 0 0,1 16,15Z" />
        </svg>
      </span>
      <span class="menu-text">View as Binary</span>
    </button>
    
    <button class="menu-item">
      <span class="menu-icon">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M14.6,16.6L19.2,12L14.6,7.4L16,6L22,12L16,18L14.6,16.6M9.4,16.6L4.8,12L9.4,7.4L8,6L2,12L8,18L9.4,16.6Z" />
        </svg>
      </span>
      <span class="menu-text">View as Code</span>
    </button>
  </div>
{/if}

<style>
  .context-menu {
    position: fixed;
    z-index: 1000;
    background: linear-gradient(135deg, #1c2133 0%, #232942 100%);
    border: 1px solid #2a3550;
    border-radius: 8px;
    min-width: 200px;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4), 
                0 0 10px rgba(0, 0, 0, 0.2);
    padding: 6px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    animation: fadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    backdrop-filter: blur(4px);
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px) scale(0.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  
  .menu-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 9px 12px;
    border: none;
    background: none;
    color: #e4e9f5;
    text-align: left;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.15s ease;
    position: relative;
    overflow: hidden;
  }
  
  .menu-item::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(90deg, rgba(96, 184, 255, 0.1), rgba(96, 184, 255, 0));
    opacity: 0;
    transition: opacity 0.15s ease;
  }
  
  .menu-item:hover:not(.disabled) {
    background-color: rgba(96, 184, 255, 0.08);
  }
  
  .menu-item:hover:not(.disabled)::after {
    opacity: 1;
  }
  
  .menu-item:active:not(.disabled) {
    background-color: rgba(96, 184, 255, 0.15);
    transform: translateY(1px);
  }
  
  .menu-item.disabled {
    color: #576280;
    cursor: default;
    opacity: 0.6;
  }
  
  .menu-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 10px;
    width: 18px;
    height: 18px;
    color: #60b8ff;
  }
  
  .menu-text {
    flex-grow: 1;
    font-weight: 500;
  }
  
  .shortcut {
    color: #8597b9;
    font-size: 12px;
    margin-left: 16px;
    opacity: 0.8;
  }
  
  .menu-divider {
    height: 1px;
    background-color: #2a3550;
    margin: 6px 3px;
    opacity: 0.7;
  }
</style>