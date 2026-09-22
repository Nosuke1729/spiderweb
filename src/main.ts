import './style.css';
import { Game } from './core/Game';

const app=document.querySelector<HTMLElement>('#app');
if(!app)throw new Error('Missing game root');
new Game(app);
