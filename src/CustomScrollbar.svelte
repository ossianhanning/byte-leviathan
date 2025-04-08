<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let contentHeight: number = 0;
  export let viewportHeight: number = 0;
  export let scrollTop: number = 0;

  let isDragging = false;
  let lastClientY = 0;

  let track: HTMLDivElement;
  let thumb: HTMLDivElement;

  const dispatch = createEventDispatcher<{
    scroll: number;
  }>();

  $: thumbHeight = getThumbHeight(contentHeight, viewportHeight);
  $: thumbTop = getThumbPosition(scrollTop, contentHeight, viewportHeight, thumbHeight);
  $: isVisible = contentHeight > viewportHeight;
  
  function getThumbHeight(contentHeight: number, viewportHeight: number): number {
    if (contentHeight <= viewportHeight) return viewportHeight;
    return Math.max(50, (viewportHeight / contentHeight) * viewportHeight);
  }
  
  function getThumbPosition(scrollTop: number, contentHeight: number, viewportHeight: number, thumbHeight: number): number {
    if (contentHeight <= viewportHeight) return 0;
    const scrollableHeight = viewportHeight - thumbHeight;
    const maxScrollTop = contentHeight - viewportHeight;
    const scrollRatio = scrollTop / maxScrollTop;
    return scrollRatio * scrollableHeight;
  }
  
  function handleTrackClick(e: MouseEvent): void {
    if (!track || e.target !== track) return;
    
    const trackRect = track.getBoundingClientRect();
    const clickPositionY = e.clientY - trackRect.top;
    const thumbHeight = getThumbHeight(contentHeight, viewportHeight);
    const scrollableTrackHeight = viewportHeight - thumbHeight;
    
    if (scrollableTrackHeight <= 0) return;

    const targetThumbTop = Math.max(0, Math.min(scrollableTrackHeight, clickPositionY - (thumbHeight / 2)));
    const scrollRatio = targetThumbTop / scrollableTrackHeight;
    const newScrollTop = Math.round(scrollRatio * (contentHeight - viewportHeight));

    dispatch('scroll', newScrollTop);
  }
  
  function handleMouseDown(e: MouseEvent): void {
    e.preventDefault();
    isDragging = true;
    lastClientY = e.clientY;

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    document.body.style.userSelect = 'none';
    if (thumb) {
      thumb.style.transition = 'none';
    }
  }
  
  function handleMouseMove(e: MouseEvent): void {
    if (!isDragging || !track) return;

    const thumbHeight = getThumbHeight(contentHeight, viewportHeight);
    const scrollableTrackHeight = viewportHeight - thumbHeight;
    
    if (scrollableTrackHeight <= 0) return;

    const deltaY = e.clientY - lastClientY;
    const currentThumbTop = getThumbPosition(scrollTop, contentHeight, viewportHeight, thumbHeight);
    const targetThumbTop = Math.max(0, Math.min(scrollableTrackHeight, currentThumbTop + deltaY));

    const scrollRatio = targetThumbTop / scrollableTrackHeight;
    const newScrollTop = Math.round(scrollRatio * (contentHeight - viewportHeight));

    lastClientY = e.clientY;

    dispatch('scroll', newScrollTop);
  }
    function handleMouseUp(): void {
    isDragging = false;

    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);

    document.body.style.userSelect = '';
    if (thumb) {
      thumb.style.transition = '';
    }
  }
  
  function handleKeyboardTrackInteraction(): void {

    if (!track) return;
    
    const trackRect = track.getBoundingClientRect();
    const thumbHeight = getThumbHeight(contentHeight, viewportHeight);
    const scrollableTrackHeight = viewportHeight - thumbHeight;
    
    if (scrollableTrackHeight <= 0) return;

    const targetThumbTop = Math.max(0, Math.min(scrollableTrackHeight, (trackRect.height / 2) - (thumbHeight / 2)));
    const scrollRatio = targetThumbTop / scrollableTrackHeight;
    const newScrollTop = Math.round(scrollRatio * (contentHeight - viewportHeight));

    dispatch('scroll', newScrollTop);
  }
</script>

{#if isVisible}
  <div class="scrollbar-container">    <div
      class="scrollbar-track"
      bind:this={track}
      on:click={handleTrackClick}
      on:keydown={(e) => e.key === 'Enter' && handleKeyboardTrackInteraction()}
      tabindex="0"
      role="scrollbar"
      aria-controls="scrollable-content"
      aria-valuenow={scrollTop}
      aria-valuemin="0"
      aria-valuemax={Math.max(0, contentHeight - viewportHeight)}
      aria-orientation="vertical"
    >
      <div
        class="scrollbar-thumb"
        class:active={isDragging}
        bind:this={thumb}
        style="height: {thumbHeight}px; transform: translateY({thumbTop}px);"
        on:mousedown={handleMouseDown}
        role="presentation"
      >
        <div class="thumb-grip"></div>
      </div>
    </div>
  </div>
{/if}

<style>
  .scrollbar-container {
    position: absolute;
    right: 0;
    top: 0;
    width: 14px;
    background-color: transparent;
    z-index: 100;
    height: 100%;
  }
  
  .scrollbar-track {
    position: absolute;
    right: 4px;
    top: 0;
    bottom: 0;
    width: 6px;
    background-color: rgba(30, 37, 59, 0.3);
    border-radius: 6px;
    height: 100%;
  }
  
  .scrollbar-track:hover {
    width: 6px;
    background-color: rgba(42, 53, 80, 0.5);
  }
  
  .scrollbar-thumb {
    position: absolute;
    right: 0;
    width: 6px;
    background: linear-gradient(180deg, #3055b5 0%, #1f3c82 100%);
    border-radius: 6px;
    cursor: pointer;
    will-change: transform;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .scrollbar-thumb:hover {
    background: linear-gradient(180deg, #3866d6 0%, #264da5 100%);
    width: 6px;
    box-shadow: 0 2px 8px rgba(48, 85, 181, 0.5);
  }
  
  .scrollbar-thumb.active {
    background: linear-gradient(180deg, #4075e6 0%, #2855c2 100%);
    width: 6px;
    box-shadow: 0 2px 12px rgba(48, 85, 181, 0.7);
  }
  
  .thumb-grip {
    opacity: 0;
    width: 4px;
    height: 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    transition: opacity 0.15s ease;
  }
  
  .thumb-grip::before,
  .thumb-grip::after {
    content: '';
    width: 4px;
    height: 1px;
    background-color: rgba(255, 255, 255, 0.6);
    border-radius: 1px;
  }
  
  .thumb-grip::after {
    width: 4px;
    height: 1px;
    background-color: rgba(255, 255, 255, 0.6);
    border-radius: 1px;
  }
  
  .scrollbar-thumb:hover .thumb-grip,
  .scrollbar-thumb.active .thumb-grip {
    opacity: 1;
  }
</style>