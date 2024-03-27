import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Toast = {
  id: symbol;
  message: string;
  duration: number;
};

type ToastOptions = Partial<Pick<Toast, 'duration'>>;

export const store = writable<Toast[]>([]);
const append = (toast: Omit<Toast, 'id'>) => {
  if (!browser) {
    throw new Error('toast can only be used in browser');
  }
  store.update((toasts) => [...toasts, { id: Symbol(), ...toast }]);
};

export const toast = (message: string, options?: ToastOptions) => append({ message, duration: 3000, ...options });
