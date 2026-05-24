import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

// NOTE: StrictMode intentionally double-mounts effects in dev to surface
// cleanup bugs. That doesn't play nicely with our manually-managed Pixi
// canvas — two Applications get created and one's residual canvas can stay
// in the DOM, showing as a "ghost" duplicate bike. Disabled here. Production
// builds aren't affected by StrictMode anyway.
createRoot(root).render(<App />);
