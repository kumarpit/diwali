import { writable } from 'svelte/store';

export type Toast = {
  id: number;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning';
  duration?: number;
};

const _toasts = writable<Toast[]>([]);
let nextId = 0;

export const toastStore = {
  subscribe: _toasts.subscribe,

  show(message: string, type: Toast['type'] = 'info', duration = 3000) {
    const id = nextId++;
    const toast: Toast = { id, message, type, duration };

    _toasts.update(toasts => [...toasts, toast]);

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }

    return id;
  },

  dismiss(id: number) {
    _toasts.update(toasts => toasts.filter(t => t.id !== id));
  },

  clear() {
    _toasts.set([]);
  }
};
