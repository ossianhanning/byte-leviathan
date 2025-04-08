/// <reference types="svelte" />

declare module '*.svelte' {
    const component: import('svelte').SvelteComponentTyped;
    export default component;
}