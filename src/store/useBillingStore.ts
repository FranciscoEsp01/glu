import { create } from 'zustand';
import { billingRequest, type BillingStatus } from '../services/billing';
import { errorText } from '../lib/platform';
let pending: Promise<void> | undefined;
export const useBillingStore = create<{
  status: BillingStatus | null;
  loading: boolean;
  error: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  refresh: () => Promise<void>;
}>((set) => ({
  status: null,
  loading: false,
  error: '',
  open: false,
  setOpen: (open) => set({ open }),
  refresh: () =>
    (pending ??= (async () => {
      set({ loading: true, error: '' });
      try {
        set({ status: await billingRequest<BillingStatus>('billing', { action: 'status' }) });
      } catch (error) {
        set({ status: null, error: errorText(error) });
      } finally {
        set({ loading: false });
        pending = undefined;
      }
    })()),
}));
