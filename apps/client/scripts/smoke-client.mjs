// Headless smoke test: connect to the local Colyseus server, join the race
// room, send a couple of inputs, verify we receive state. Exits 0 on success.
import { Client } from 'colyseus.js';

const url = process.env.SERVER_URL ?? 'ws://localhost:2567';
const client = new Client(url);

const timeout = setTimeout(() => {
  console.error('TIMEOUT — no state in 5s');
  process.exit(2);
}, 5000);

try {
  const room = await client.joinOrCreate('race', { name: 'Smoke', vehicle: 'scout' });
  console.log('joined', room.roomId, 'sid', room.sessionId);

  let stateChanges = 0;
  let lastSpeed = 0;

  room.onStateChange((state) => {
    stateChanges += 1;
    const me = state.players.get(room.sessionId);
    if (me) lastSpeed = me.speed;
    if (stateChanges === 1) console.log('first state, players=', state.players.size);
    if (stateChanges >= 12) {
      clearTimeout(timeout);
      console.log(
        'OK statePatches=' + stateChanges + ' lastSpeed=' + lastSpeed.toFixed(2) + ' tick=' + state.tick,
      );
      room.leave();
      process.exit(0);
    }
  });

  // Send throttle for ~600ms to exercise the input path.
  let seq = 0;
  const interval = setInterval(() => {
    seq += 1;
    room.send('input', { seq, tick: seq, flags: 1 /* THROTTLE */ });
  }, 33);
  setTimeout(() => clearInterval(interval), 600);
} catch (err) {
  clearTimeout(timeout);
  console.error('ERR', err);
  process.exit(1);
}
