import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';
import { runSplash } from './ui/splash/splash';

runSplash();

createRoot(document.getElementById('root')!).render(<App />);
