import { BillingModal } from './components/BillingModal';
import { useBillingStore } from './store/useBillingStore';
import { useAccount } from './components/AccountContext';
import { useEffect } from 'react';
import { useMeetingStore } from './store/useMeetingStore';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { MeetingView } from './components/MeetingView';
import { FloatingWidget } from './components/FloatingWidget';
import { CommandPalette } from './components/CommandPalette';
import { SettingsModal } from './components/SettingsModal';
import { NewMeetingModal } from './components/NewMeetingModal';
import { KnowledgeModal } from './components/KnowledgeModal';
import { BackupModal } from './components/BackupModal';
import { desktop } from './lib/platform';
export function App() {
  const s = useMeetingStore();
  const account = useAccount();
  useEffect(() => {
    let lastRefresh = 0;
    const refresh = () => {
      if (Date.now() - lastRefresh > 5000) {
        lastRefresh = Date.now();
        void useBillingStore.getState().refresh();
      }
    };
    const required = () => {
      useBillingStore.getState().setOpen(true);
      refresh();
    };
    refresh();
    window.addEventListener('focus', refresh);
    const usageChanged = () => void useBillingStore.getState().refresh();
    window.addEventListener('glu-billing-refresh', usageChanged);
    window.addEventListener('glu-billing-required', required);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('glu-billing-refresh', usageChanged);
      window.removeEventListener('glu-billing-required', required);
    };
  }, []);
  useEffect(() => {
    void s.initialize();
  }, []);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () =>
      document.documentElement.classList.toggle(
        'dark',
        s.settings.theme === 'dark' || (s.settings.theme === 'system' && mq.matches),
      );
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [s.settings.theme]);
  useEffect(() => {
    const action = (command: string) => {
      if (!account.active) return;
      const state = useMeetingStore.getState();
      if (command === 'record') {
        if (state.isRecording) void state.stopRecordingAndProcess();
        else {
          state.setViewMode('main');
          state.toggleNewMeetingModal(true);
        }
      } else if (command === 'pause') void state.togglePauseRecording();
      else window.dispatchEvent(new Event('glu-notes'));
    };
    const key = (e: KeyboardEvent) => {
      if (!account.active) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        useMeetingStore.getState().toggleCommandPalette();
      }
      if (e.shiftKey && !desktop()) {
        const c = { r: 'record', m: 'pause', n: 'notes' }[e.key.toLowerCase()];
        if (c) {
          e.preventDefault();
          action(c);
        }
      }
    };
    window.addEventListener('keydown', key);
    const unload = (e: BeforeUnloadEvent) => {
      if (useMeetingStore.getState().isRecording || useMeetingStore.getState().isProcessingAI) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', unload);
    const api = (window as any).__TAURI__;
    const unlisteners: Promise<() => void>[] = api
      ? [
          api.event.listen('glu-shortcut', (event: { payload: string }) => action(event.payload)),
          api.event.listen('glu-close-blocked', () =>
            useMeetingStore.setState({ error: 'Finaliza la grabación antes de cerrar Glu.' }),
          ),
        ]
      : [];
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('beforeunload', unload);
      unlisteners.forEach((p) => void p.then((off) => off()));
    };
  }, [account.active]);
  return (
    <main className={`app-shell ${s.viewMode === 'floating_pill' ? 'compact-shell' : ''}`}>
      {s.viewMode === 'main' && (
        <>
          <Sidebar />
          <div className="main-column">
            <TitleBar />
            <MeetingView />
          </div>
        </>
      )}
      {(s.isRecording || s.viewMode === 'floating_pill') && <FloatingWidget />}
      {s.error && (
        <div className="error-banner" role="alert">
          <span>{s.error}</span>
          <button onClick={s.clearError} aria-label="Cerrar error">
            ×
          </button>
        </div>
      )}
      <KnowledgeModal />
      <BackupModal />
      <CommandPalette />
      <SettingsModal />
      <NewMeetingModal />
      <BillingModal />
    </main>
  );
}
export default App;
