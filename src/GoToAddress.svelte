<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let visible: boolean = false;

  let addressInput: string = '';
  let error: string | null = null;

  const focusOnMount = (node: HTMLElement) => {
    setTimeout(() => node.focus(), 0);
    return {};
  };

  const dispatch = createEventDispatcher<{
    navigate: number;
    close: void;
  }>();

  function handleSubmit() {
    error = null;

    if (!addressInput.trim()) {
      error = 'Please enter an address';
      return;
    }

    let cleanInput = addressInput.trim().toLowerCase();
    if (cleanInput.startsWith('0x')) {
      cleanInput = cleanInput.substring(2);
    }

    try {
      let address = parseInt(cleanInput, 16);

      if (isNaN(address) || address < 0) {
        error = 'Invalid hexadecimal address';
        return;
      }

      address = Math.floor(address / 16) * 16;

      dispatch('navigate', address);

      addressInput = '';
      visible = false;
    } catch (e) {
      error = 'Invalid hexadecimal address';
    }
  }
  
  function handleClose() {
    addressInput = '';
    error = null;
    dispatch('close');
  }
  
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'Enter') {
      handleSubmit();
    }
  }
</script>

{#if visible}
  <div class="modal-backdrop" on:click={handleClose} on:keydown={handleKeyDown} role="dialog" aria-modal="true" tabindex="-1">
    <div class="modal-container" aria-labelledby="dialog-title">
      <div class="modal-header">
        <div class="header-icon" aria-hidden="true">⬢</div>
        <h3 id="dialog-title">Go to Address</h3>
        <button class="close-button" on:click={handleClose} aria-label="Close">×</button>
      </div>
      
      <div class="modal-body">
        <form on:submit|preventDefault={handleSubmit}>
          <div class="form-group">
            <input
              id="address-input"
              type="text"
              bind:value={addressInput}
              placeholder="Enter hex address (e.g., 0A0 or 0x0A0)"
              on:keydown={handleKeyDown}
              use:focusOnMount
            />
            <button type="submit" class="submit-button">
              <span class="button-text">Go</span>
              <span class="button-icon">→</span>
            </button>
          </div>
        </form>
            
        {#if error}
          <div class="error-message">
            <span class="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(8, 10, 20, 0.7);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s ease-out;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  .modal-container {
    background: linear-gradient(135deg, #1c2133 0%, #232942 100%);
    border-radius: 10px;
    width: 420px;
    max-width: 90vw;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3), 
                0 0 20px rgba(96, 184, 255, 0.1);
    color: #e4e9f5;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    animation: slideIn 0.25s cubic-bezier(0.17, 0.67, 0.21, 1.02);
    border: 1px solid #2a3550;
    overflow: hidden;
  }
  
  @keyframes slideIn {
    from { transform: translateY(30px); opacity: 0.5; }
    to { transform: translateY(0); opacity: 1; }
  }
  
  .modal-header {
    display: flex;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #2a3550;
    background: linear-gradient(90deg, #1f2740 0%, #2a3550 100%);
  }
  
  .header-icon {
    font-size: 18px;
    color: #60b8ff;
    margin-right: 10px;
    text-shadow: 0 0 8px rgba(96, 184, 255, 0.5);
  }
  
  .modal-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #e4e9f5;
    flex: 1;
    letter-spacing: 0.3px;
  }
  
  .close-button {
    background: none;
    border: none;
    color: #8597b9;
    font-size: 26px;
    cursor: pointer;
    padding: 0;
    margin: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s ease;
  }
  
  .close-button:hover {
    color: #e4e9f5;
    background-color: rgba(255, 255, 255, 0.1);
    transform: rotate(90deg);
  }
  
  .modal-body {
    padding: 24px;
  }
  
  .form-group {
    margin-bottom: 20px;
    display: flex;
    gap: 12px;
  }
  
  input {
    flex: 1;
    padding: 12px 16px;
    background-color: rgba(21, 26, 46, 0.7);
    border: 1px solid #2a3550;
    color: #e4e9f5;
    border-radius: 6px;
    font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Consolas', monospace;
    font-size: 15px;
    transition: all 0.2s ease;
    box-sizing: border-box;
  }
  
  input:focus {
    outline: none;
    border-color: #60b8ff;
    box-shadow: 0 0 0 2px rgba(96, 184, 255, 0.2);
    background-color: rgba(21, 26, 46, 0.9);
  }
  
  .error-message {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #f28779;
    margin-top: 14px;
    font-size: 14px;
    padding: 10px 14px;
    background-color: rgba(242, 135, 121, 0.1);
    border-radius: 6px;
    border-left: 3px solid #f28779;
    animation: errorShake 0.4s ease-in-out;
  }
  
  @keyframes errorShake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-5px); }
    40% { transform: translateX(5px); }
    60% { transform: translateX(-3px); }
    80% { transform: translateX(3px); }
  }
  
  .error-icon {
    font-size: 16px;
  }
  
  .submit-button {
    background: linear-gradient(180deg, #3055b5 0%, #1f3c82 100%);
    color: white;
    font-weight: 500;
    border: none;
    padding: 12px 20px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    box-shadow: 0 2px 8px rgba(21, 45, 102, 0.5);
  }
  
  .submit-button:hover {
    background: linear-gradient(180deg, #3866d6 0%, #264da5 100%);
    box-shadow: 0 4px 12px rgba(21, 45, 102, 0.7);
  }
  
  .submit-button:active {
    transform: translateY(1px);
    box-shadow: 0 1px 3px rgba(21, 45, 102, 0.7);
  }
  
  .button-icon {
    font-size: 16px;
    transition: transform 0.2s ease;
  }
  
  .submit-button:hover .button-icon {
    transform: translateX(3px);
  }
</style>