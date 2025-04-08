// main.ts
import App from './App.svelte';
import { mount } from 'svelte';

const target = document.getElementById("app");

if (target) {
  const app = mount(App, { target });
  
} else {
  console.error("Could not find element with id 'app'");
}