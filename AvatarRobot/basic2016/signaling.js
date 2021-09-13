"use strict";
 
let WebSocketServer = require('ws').Server;
let port = 3001;
let wsServer = new WebSocketServer({ port: port });
console.log('websocket server start. port=' + port);
 
wsServer.on('connection', function(ws) {
  console.log('-- websocket connected --');
  ws.on('message', function(message) {

	// �f�o�b�O�p�@������JSON����M���Ă��邩�H�\������
    let obj = JSON.parse(message);
  	console.log(obj);

    wsServer.clients.forEach(function each(client) {
      if (isSame(ws, client)) {
        console.log('- skip sender -');
      }
      else {
        console.log('- client send -');
        client.send(message);
      }
    });
  });
});
 
function isSame(ws1, ws2) {
  // -- compare object --
  return (ws1 === ws2);     
}