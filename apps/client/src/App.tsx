import { RaceScene } from './scenes/RaceScene.tsx';
import { useGame } from './store/game.ts';
import { Landing } from './ui/Landing.tsx';
import { MainMenu } from './ui/MainMenu.tsx';

export function App() {
  const scene = useGame((s) => s.scene);

  return (
    <div className="relative h-full w-full">
      {scene === 'landing' && <Landing />}
      {scene === 'menu' && <MainMenu />}
      {scene === 'race' && <RaceScene />}
    </div>
  );
}
