import { useEffect, useState, type ReactNode } from 'react';
import { speak, speechAvailable } from '../speech';
import { useToasts } from '../store';
import { sfx } from '../sound';

export function Speak({ text, label = 'Read aloud', enabled = true }: { text: string; label?: string; enabled?: boolean }) {
  const [msg, setMsg] = useState('');
  if (!enabled) return null;
  return (
    <span className="row" style={{ gap: 4, display: 'inline-flex' }}>
      <button className="speak" aria-label={label} title={label} onClick={() => { if (!speak(text)) setMsg('Read-aloud is not available in this browser.'); }}>🔊</button>
      {msg && <span className="small muted" role="status">{msg}</span>}
    </span>
  );
}
export const canSpeak = speechAvailable;

/** Silver coin, the game's only spendable currency. */
export function Coin({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ flex: 'none', verticalAlign: '-3px' }}>
      <defs>
        <radialGradient id="coin-g" cx="35%" cy="30%" r="75%"><stop offset="0" stopColor="#ffffff" /><stop offset="0.45" stopColor="#d7dde8" /><stop offset="1" stopColor="#8a94a8" /></radialGradient>
      </defs>
      <circle cx="12" cy="12" r="10.5" fill="url(#coin-g)" stroke="#1b1446" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="7.2" fill="none" stroke="#6b7488" strokeWidth="1.2" />
      <path d="M12 7.2 L13.4 10.6 L17 10.8 L14.2 13 L15.1 16.5 L12 14.6 L8.9 16.5 L9.8 13 L7 10.8 L10.6 10.6 Z" fill="#7d879b" />
      <path d="M6 7.5 A8 8 0 0 1 11 3.6" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

export function Points({ value }: { value: number }) {
  return <span className="points" aria-label={`${value} coins`}><Coin size={20} /> {value}</span>;
}

export function Toasts() {
  const toasts = useToasts();
  return <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className="toast">{t.text}</div>)}</div>;
}

export function Modal({ children, onClose, title }: { children: ReactNode; onClose?: () => void; title: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="card modal">
        <h2 style={{ marginBottom: 8 }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Btn(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: string; size?: string }) {
  const { kind = '', size = '', className = '', onClick, ...rest } = props;
  return <button {...rest} className={`btn ${kind} ${size} ${className}`} onClick={(e) => { sfx.click(); onClick?.(e); }} />;
}

export function Bar({ value, max, color }: { value: number; max: number; color?: string }) {
  return <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><div style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%`, background: color }} /></div>;
}
