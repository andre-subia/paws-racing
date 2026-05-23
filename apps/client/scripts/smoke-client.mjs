// Headless smoke test: create → join-by-code → ready → host start → countdown
// → racing → inputs accepted. Exits 0 on success.
import { Client } from 'colyseus.js';

const url = process.env.SERVER_URL ?? 'ws://localhost:2567';
const client = new Client(url);

const timeout = setTimeout(() => {
  console.error('TIMEOUT');
  process.exit(2);
}, 8000);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  // Code is generated client-side so filterBy can match against the original
  // create options. The server simply respects what the client passes.
  const code = Array.from({ length: 5 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
  const host = await client.create('race', { name: 'Host', vehicle: 'scout', code });
  for (let i = 0; i < 50 && !host.state.code; i++) await wait(20);
  if (host.state.code !== code) {
    console.error('FAIL — server did not adopt client code, got', host.state.code);
    process.exit(7);
  }
  console.log('host joined', host.roomId, 'code', code);

  // A separate join with empty code (public quickRace) should NOT land in our coded room.
  const decoy = await client.joinOrCreate('race', { name: 'Decoy', vehicle: 'scout', code: '' });
  if (decoy.roomId === host.roomId) {
    console.error('FAIL — decoy without code landed in coded room (filterBy broken)');
    process.exit(8);
  }
  decoy.leave();

  const joiner = await client.join('race', { name: 'Joiner', vehicle: 'bruiser', code });
  console.log('joiner joined', joiner.roomId);
  if (joiner.roomId !== host.roomId) {
    console.error('FAIL — code-join landed in a different room');
    process.exit(3);
  }

  joiner.send('ready', {});
  await wait(150);

  host.send('start', {});
  await wait(150);
  if (host.state.phase !== 'countdown') {
    console.error('FAIL — expected countdown, got', host.state.phase);
    process.exit(4);
  }
  console.log('phase=countdown ✓');

  await wait(3300);
  if (host.state.phase !== 'racing') {
    console.error('FAIL — expected racing, got', host.state.phase);
    process.exit(5);
  }
  console.log('phase=racing ✓');

  let seq = 0;
  for (let i = 0; i < 12; i++) {
    seq += 1;
    host.send('input', { seq, tick: seq, flags: 1 });
    await wait(33);
  }
  await wait(200);
  const me = host.state.players.get(host.sessionId);
  console.log('host speed after throttle:', me?.speed?.toFixed(2));
  if (!me || me.speed <= 0) {
    console.error('FAIL — host did not accelerate');
    process.exit(6);
  }

  clearTimeout(timeout);
  console.log('OK');
  host.leave();
  joiner.leave();
  process.exit(0);
} catch (err) {
  clearTimeout(timeout);
  console.error('ERR', err);
  process.exit(1);
}
