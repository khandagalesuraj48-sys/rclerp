// a small relay (TURN server) on this computer, for tests only: 127.0.0.1:3478, name "rig" / password "rig-relay-pass"
// Used by relay73.js only. It needs `npm install node-turn` in the test folder (not in package.json – nothing of the app uses it).
// After ANY npm install in the rig's test folder put the stand-in for @sparticuz/chromium back (see HANDOVER, update-73).
const Turn = require('node-turn');
const server = new Turn({ authMech: 'long-term', credentials: { rig: 'rig-relay-pass' }, listeningIps: ['127.0.0.1'], relayIps: ['127.0.0.1'], listeningPort: Number(process.env.TURN_PORT || 3478), debugLevel: 'ERROR', realm: 'rig' });
server.start(); console.log('turn stand-in on 127.0.0.1:' + (process.env.TURN_PORT || 3478));
