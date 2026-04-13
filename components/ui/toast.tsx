'use client';

/**
 * Toast helper -- thin wrapper around `sonner`.
 *
 * Install sonner first:
 *   pnpm add sonner        (or npm / yarn)
 *
 * Then render <Toaster /> once in your root layout:
 *   import { Toaster } from 'sonner';
 *   <Toaster position="top-right" theme="dark" richColors />
 *
 * Usage anywhere:
 *   import { toast } from '@/components/ui/toast';
 *   toast.success('Payment sent!');
 *   toast.error('Transaction failed');
 *   toast.promise(fetchData(), { loading: '...', success: 'Done', error: 'Oops' });
 */

import { toast as sonnerToast } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Re-export with pre-configured defaults                             */
/* ------------------------------------------------------------------ */

export const toast = {
  success(message: string, opts?: Parameters<typeof sonnerToast.success>[1]) {
    return sonnerToast.success(message, {
      duration: 4000,
      ...opts,
    });
  },

  error(message: string, opts?: Parameters<typeof sonnerToast.error>[1]) {
    return sonnerToast.error(message, {
      duration: 5000,
      ...opts,
    });
  },

  warning(message: string, opts?: Parameters<typeof sonnerToast.warning>[1]) {
    return sonnerToast.warning(message, {
      duration: 4500,
      ...opts,
    });
  },

  info(message: string, opts?: Parameters<typeof sonnerToast.info>[1]) {
    return sonnerToast.info(message, {
      duration: 4000,
      ...opts,
    });
  },

  promise<T>(
    promise: Promise<T>,
    msgs: { loading: string; success: string; error: string },
  ) {
    return sonnerToast.promise(promise, msgs);
  },

  /** Dismiss a specific toast or all toasts */
  dismiss(id?: string | number) {
    return sonnerToast.dismiss(id);
  },
};
