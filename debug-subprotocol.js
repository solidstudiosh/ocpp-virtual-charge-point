const { WebSocket } = require('ws');

// Configuration depuis votre erreur
const endpoint = 'ws://preprod-ws.mobilyweb.fr';
const chargePointId = 'MOBILYTEST';
const ocppVersion = 'OCPP_1.6';

// Fonction pour convertir la version OCPP en protocole
const toProtocolVersion = (ocppVersion) => {
  if (ocppVersion === 'OCPP_1.6') {
    return 'ocpp1.6';
  }
  if (ocppVersion === 'OCPP_2.0.1') {
    return 'ocpp2.0.1';
  }
  if (ocppVersion === 'OCPP_2.1') {
    return 'ocpp2.1';
  }
  throw new Error(`Unrecognized OCPP version ${ocppVersion}`);
};

const websocketUrl = `${endpoint}/${chargePointId}`;
const protocol = toProtocolVersion(ocppVersion);

console.log('🔍 Diagnostic de la connexion WebSocket');
console.log('📡 URL:', websocketUrl);
console.log('🔌 Protocole demandé:', protocol);
console.log('📋 Protocoles supportés couramment: ocpp1.6, ocpp2.0.1, ocpp2.1');
console.log('');

console.log('🚀 Tentative de connexion...');

const ws = new WebSocket(websocketUrl, [protocol], {
  rejectUnauthorized: false,
  followRedirects: true
});

ws.on('open', () => {
  console.log('✅ Connexion réussie!');
  console.log('🔌 Protocole négocié:', ws.protocol || 'aucun');
  console.log('📊 ReadyState:', ws.readyState);
  ws.close();
});

ws.on('error', (error) => {
  console.log('❌ Erreur de connexion:');
  console.log('📄 Message:', error.message);
  console.log('📋 Code:', error.code);
  console.log('📊 Détails complets:', error);
  
  // Essayons de récupérer plus d'infos sur la réponse HTTP
  if (error.message.includes('invalid subprotocol')) {
    console.log('');
    console.log('🔍 Analyse: Le serveur a renvoyé un sous-protocole non supporté');
    console.log('💡 Solutions possibles:');
    console.log('   - Vérifier que le serveur supporte le protocole "ocpp1.6"');
    console.log('   - Essayer avec d\'autres protocoles (ocpp1.5, ocpp2.0, etc.)');
    console.log('   - Vérifier la configuration du serveur OCPP');
  }
});

ws.on('upgrade', (response) => {
  console.log('🔄 Upgrade HTTP reçu:');
  console.log('📊 Status:', response.statusCode, response.statusMessage);
  console.log('📋 Headers:', response.headers);
  if (response.headers['sec-websocket-protocol']) {
    console.log('🔌 Protocole WebSocket renvoyé par le serveur:', response.headers['sec-websocket-protocol']);
  } else {
    console.log('⚠️  Aucun header sec-websocket-protocol dans la réponse');
  }
});

ws.on('close', (code, reason) => {
  console.log('🚪 Connexion fermée');
  console.log('📊 Code:', code);
  console.log('📄 Raison:', reason.toString());
});

// Timeout après 10 secondes
setTimeout(() => {
  if (ws.readyState === WebSocket.CONNECTING) {
    console.log('⏰ Timeout - fermeture de la connexion');
    ws.terminate();
  }
}, 10000);