'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useToastStore } from '@/stores/toast.store';

const styles: Record<string, string> = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  warning: 'bg-yellow-500 text-black',
  info: 'bg-blue-600 text-white',
};

const icons: Record<string, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm cursor-pointer ${styles[toast.type]}`}
            onClick={() => removeToast(toast.id)}
          >
            <span className="font-bold">{icons[toast.type]}</span>
            <span className="flex-1">{toast.message}</span>
            <button className="ml-2 opacity-60 hover:opacity-100 text-xs">✕</button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
