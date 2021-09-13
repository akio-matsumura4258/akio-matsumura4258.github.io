# akio-matsumura4258.github.io
HTTP Server for me
#ビデオチャット構築メモ  
<div align="right">  

2021.9.7～  
![画像表示](img/sailor_logo-non_anchor_mini_mini.png)  
電気設計課　松村  
</div>  

参考記事  
[WebRTCとは - P2Pでの動画・音声のリアルタイム通信](https://qiita.com/teruya_kusumoto/items/30ae0e92fd377dc41dbc)  
[ビデオチャットアプリを作る ( WebRTC + Node.js + Socket.IO )](https://www.hiramine.com/programming/videochat_webrtc/index.html)  
[WebRTC でビデオチャットアプリを作ってみた](https://neos21.net/blog/2020/07/18-02.html)  
[WebRTC入門2016](https://html5experts.jp/series/webrtc2016/)  

--------------------------  
当初「ライブストリーミング」というキーワードで調査を始めたが、”ストリーミング”は1対多の動画配信になるので、ちょっと違う  
やりたいのはTeamsやZoomのような”ビデオチャット”ということで、「ビデオチャット」での調査に切り替え  
--------------------------  

###方式  
ビデオチャットの場合は、ほぼ[WebRTC](https://webrtc.org/)を使うもよう・・・というよりそれ以外は見つからなかった

WebRTCでできること

* カメラ、マイクといったデバイスへのアクセスする … Media Capture and Streams  
* ビデオ/オーディオ/データ通信を行う … WebRTC 1.0: Real-time Communication Between Browsers  
* ビデオ/オーディオの録画/録音を行う … MediaStream Recording  

この機能とHTML5の技術を組み合わせて利用する

* JavaScript  
* WebSocket  
などなど。。。

<br><br><br>

##実際に試す  

###HTTPサーバー  
IoTの試作を行うときにApache2.4はインストール済み(PythonとPHPも使える状態)  
WebRTCはJavaScriptで動作するので、これ以外に準備は無し  

  
###カメラの取得  
カメラは`navigator.mediaDevices.getUserMedia()`で取得する  
実質これだけでとりあえずカメラ画像は表示できる  
カメラ自体や解像度の選択をどうするかは未調査  

###P2P通信  
**RTCPeerConection**でP2Pの通信を行う  

P2P通信を行うには**SDP(Session Description Protocol)**という情報と**ICE(Interactive Connectivity Establishment)**通信経路の情報をやり取りする必要がある  

**SDP**に含まれる情報は下記

* 通信するメディアの種類（音声、映像）、メディアの形式（コーデック）、アプリケーションデータ
* IPアドレス、ポート番号
* 暗号化の鍵

**ICE**の情報(通信経路の候補 = **ICE Candidate**)はSDPの中に格納され、相手に送信される  

**Offer** と **Answer**  
最初に接続する側(発信側)が**Offer SDP**を生成し送信する  

```javascript
  // Offer SDPを生成する
  function makeOffer() {
    peerConnection = prepareNewConnection(); // RTCPeerConnectionを生成し、必要なメッセージハンドラを設定
 
    peerConnection.createOffer()
    .then(function (sessionDescription) {
      return peerConnection.setLocalDescription(sessionDescription);
    }).then(function() {
      // -- Trickle ICE の場合は、初期SDPを相手に送る -- 
      // -- Vanilla ICE の場合には、まだSDPは送らない --
      //sendSdp(peerConnection.localDescription);  <-- Vanilla ICEなので、まだ送らない
    }).catch(function(err) {
      console.error(err);
    });
  }

  function prepareNewConnection() {
    let pc_config = {"iceServers":[]};
    let peer = new RTCPeerConnection(pc_config);
 
    // --- on get local ICE candidate
    peer.onicecandidate = function (evt) {
      if (evt.candidate) { // ICE candidate が収集された場合
        console.log(evt.candidate);
 
        // Trickle ICE の場合は、ICE candidateを相手に送る
        // Vanilla ICE の場合には、何もしない
      } else { // ICE candidateの収集が完了した場合
        console.log('empty ice event');
 
        // Trickle ICE の場合は、何もしない
        // Vanilla ICE の場合には、ICE candidateを含んだSDPを相手に送る
        sendSdp(peer.localDescription);
      }
    };
 
    // --- on get remote stream ---
    if ('ontrack' in peer) {
      peer.ontrack = function(event) {
        let stream = event.streams[0];
        playVideo(remoteVideo, stream);
      };
    }
    else {
      peer.onaddstream = function(event) {
        let stream = event.stream;
        playVideo(remoteVideo, stream);
      };
    }
 
    // 通信対象の映像/音声ストリームを追加する
    if (localStream) {
      console.log('Adding local stream...');
      peer.addStream(localStream);
    }
 
 
    return peer;
  }
```

受信側は**Offer SDP**を受信したら**Answer SDP**を生成する

```javascript
  function setOffer(sessionDescription) {
    peerConnection = prepareNewConnection();
    peerConnection.setRemoteDescription(sessionDescription)
    .then(function() {
      makeAnswer();
    }).catch(function(err) {
      console.error('setRemoteDescription(offer) ERROR: ', err);
    });
  }

  function makeAnswer() {   
    peerConnection.createAnswer()
    .then(function (sessionDescription) {
      return peerConnection.setLocalDescription(sessionDescription);
    }).then(function() {
      // -- Trickle ICE の場合は、初期SDPを相手に送る -- 
      // -- Vanilla ICE の場合には、まだSDPは送らない --
      //sendSdp(peerConnection.localDescription);
    }).catch(function(err) {
      console.error(err);
    });
  }
```

発信側は**Answer SDP**を受け取り、

```javascript
  function setAnswer(sessionDescription) {
    peerConnection.setRemoteDescription(sessionDescription)
    .then(function() {
      console.log('setRemoteDescription(answer) succsess in promise');
    }).catch(function(err) {
      console.error('setRemoteDescription(answer) ERROR: ', err);
    });
  }
```

双方が相手のSDPを**setRemoteDescription()**で覚えたら、交換完了となる  
P2P通信に相手の映像/音声が含まれていればイベントが発生、**RTCPeerConnection.ontrack()** にハンドラで受ける

###WebSocketを使ったSDP交換(シグナリング)  
SDPを送受信するために、WebSocketで情報をやり取りする  

[Node.js](https://nodejs.org/en/)を使うので、14.17.6LTSをインストール  
管理者コマンドラインで、wsをインストール（実際にはsocket.ioを使ったほうがいいみたい）  

```
npm install ws
```

シグナリングサーバーのソース(signaling.js)

```javascript
"use strict";
 
let WebSocketServer = require('ws').Server;
let port = 3001;
let wsServer = new WebSocketServer({ port: port });
console.log('websocket server start. port=' + port);
 
wsServer.on('connection', function(ws) {
  console.log('-- websocket connected --');
  ws.on('message', function(message) {
    wsServer.clients.forEach(function each(client) {
      if (isSame(ws, client)) {
        console.log('- skip sender -');
      }
      else {
        client.send(message);
      }
    });
  });
});
 
function isSame(ws1, ws2) {
  // -- compare object --
  return (ws1 === ws2);     
}
```

コマンドラインでシグナリングサーバーを起動

```
node signaling.js
```

WebSocketの接続  

```javascript
  let wsUrl = 'ws://localhost:3001/';
  let ws = new WebSocket(wsUrl);
  ws.onopen = function(evt) {
    console.log('ws open()');
  };
  ws.onerror = function(err) {
    console.error('ws onerror() ERR:', err);
  };
```

メッセージ受信処理

```javascript
  ws.onmessage = function(evt) {
    console.log('ws onmessage() data:', evt.data);
    let message = JSON.parse(evt.data);
    if (message.type === 'offer') {
      // -- got offer ---
      console.log('Received offer ...');
      textToReceiveSdp.value = message.sdp;
      let offer = new RTCSessionDescription(message);
      setOffer(offer);
    }
    else if (message.type === 'answer') {
      // --- got answer ---
      console.log('Received answer ...');
      textToReceiveSdp.value = message.sdp;
      let answer = new RTCSessionDescription(message);
      setAnswer(answer);
    }
  };
```

SDPの送信  

```javascript
  function sendSdp(sessionDescription) {
    console.log('---sending sdp ---');

    textForSendSdp.value = sessionDescription.sdp;

    // --- シグナリングサーバーに送る ---
    let message = JSON.stringify(sessionDescription);
    console.log('sending SDP=' + message);
    ws.send(message);
  }
```

以上が**Vanilla ICE**の場合、**Trickle ICE**の場合は**ICE Candidate**を受け取るたびに受信側に送る  

```javascript
  function prepareNewConnection() {
    // ... 省略 ...
 
    // --- on get local ICE candidate
    peer.onicecandidate = function (evt) {
      if (evt.candidate) {
        console.log(evt.candidate);
 
        // Trickle ICE の場合は、ICE candidateを相手に送る
        sendIceCandidate(evt.candidate); // <--- ここを追加する
 
        // Vanilla ICE の場合には、何もしない
      } else {
        console.log('empty ice event');
 
        // Trickle ICE の場合は、何もしない
        
        // Vanilla ICE の場合には、ICE candidateを含んだSDPを相手に送る
        //sendSdp(peer.localDescription); // <-- ここをコメントアウトする
      }
    };
 
    // ... 省略 ....
  }
 
  function sendIceCandidate(candidate) {
    console.log('---sending ICE candidate ---');
    let obj = { type: 'candidate', ice: candidate };
    let message = JSON.stringify(obj);
    console.log('sending candidate=' + message);
    ws.send(message);
  }
```

```javascript
  ws.onmessage = function(evt) {
    console.log('ws onmessage() data:', evt.data);
    let message = JSON.parse(evt.data);
    if (message.type === 'offer') {
      // -- got offer ---
      console.log('Received offer ...');
      textToReceiveSdp.value = message.sdp;
      let offer = new RTCSessionDescription(message);
      setOffer(offer);
    }
    else if (message.type === 'answer') {
      // --- got answer ---
      console.log('Received answer ...');
      textToReceiveSdp.value = message.sdp;
      let answer = new RTCSessionDescription(message);
      setAnswer(answer);
    }
    else if (message.type === 'candidate') { // <--- ここから追加
      // --- got ICE candidate ---
      console.log('Received ICE candidate ...');
      let candidate = new RTCIceCandidate(message.ice);
      console.log(candidate);
      addIceCandidate(candidate);
    }
  };
 
  function addIceCandidate(candidate) {
    if (peerConnection) {
      peerConnection.addIceCandidate(candidate);
    }
    else {
      console.error('PeerConnection not exist!');
      return;
    }
  }
```

###NAT越えPeer-to-Peer通信  

[NAT](https://www.infraexpert.com/study/ip10.html)を経由してシグナリング処理でお互いに自分の知らないグローバルの情報を交換する必要がある  
STUNサーバーを利用してグローバルIPを取得する

![](https://html5experts.jp/wp-content/uploads/2014/03/webrtc_nat_3.png)

Googleが公開しているサーバーがよく利用されているので今回はそれを使ってみる  

```javascript
function prepareNewConnection(id) {
  let pc_config = {"iceServers":[
    {"urls": "stun:stun.l.google.com:19302"},
    {"urls": "stun:stun1.l.google.com:19302"},
    {"urls": "stun:stun2.l.google.com:19302"}
  ]};
  let peer = new RTCPeerConnection(pc_config);
  // ... 省略 ...
}
```

※本番では自前でSTUNサーバーを構築したほうがいいと思われる

