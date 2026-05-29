import { useEffect } from 'react';
import { playMusic } from './audio/music.ts';
import { RaceScene } from './scenes/RaceScene.tsx';
import { useGame } from './store/game.ts';
import { Landing } from './ui/Landing.tsx';
import { MainMenu } from './ui/MainMenu.tsx';

export function App() {
  const scene = useGame((s) => s.scene);

  // Menu/landing share the lobby theme; the race scene gets the racing theme.
  // (Autoplay-blocked playback resumes on the first user gesture.)
  useEffect(() => {
    playMusic(scene === 'race' ? 'race' : 'menu');
  }, [scene]);

  return (
    <div className="relative h-full w-full">
      {scene === 'landing' && <Landing />}
      {scene === 'menu' && <MainMenu />}
      {scene === 'race' && <RaceScene />}
    </div>
  );
}
