'use strict';

var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var turnReady;

console.log('in main.js');
var pcConfig = {
  'iceServers': [{
    'urls': 'stun:stun.l.google.com:19302'
  }]
};
console.log('pcConfig:' + pcConfig);

console.log('Set up audio and video regardless of what devices are present.');
var sdpConstraints = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true
};
console.log('sdpConstraints' + sdpConstraints);

/////////////////////////////////////////////



var room ;
console.log('Could prompt for room name:');
room = prompt('Enter room name:');
console.log('room:' + room);

var socket = io.connect();
console.log('socket:' + socket);

if (room !== '') {
  console.log('create or join' + room);
  socket.emit('create or join', room);
  console.log('Attempted to create or  join room', room);

}

socket.on('created', function(room) {
  console.log('Created room ' + room);
  isInitiator = true;
});

socket.on('full', function(room) {
  console.log('Room ' + room + ' is full');
});

socket.on('join', function (room){
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

socket.on('joined', function(room) {
  console.log('joined: ' + room);
  isChannelReady = true;
});

socket.on('log', function(array) {
  console.log.apply(console, array);
});

////////////////////////////////////////////////

function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', message);
}

console.log('This client receives a message');
socket.on('message', function(message) {
  console.log('Client received message:', message);
  if (message === 'got user media') {
    console.log('message is gotusermedia so maybeStart()');
    maybeStart();
  } else if (message.type === 'offer') {
    console.log('message is offer');
    if (!isInitiator && !isStarted) {
      console.log('!isInitiator && isStarted so maybestart()');
      maybeStart();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message));
    console.log(' pc.setRemoteDescription(new RTCSessionDescription(message)): offer');
    doAnswer();
  } else if (message.type === 'answer' && isStarted) {
    console.log('message is answer');
    pc.setRemoteDescription(new RTCSessionDescription(message));
    console.log(' pc.setRemoteDescription(new RTCSessionDescription(message)): answer');
  } else if (message.type === 'candidate' && isStarted) {
    console.log('message is candidate');
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    console.log('candidate:' + candidate);
    pc.addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    console.log('message is bye');
    handleRemoteHangup();
  }
});

////////////////////////////////////////////////////

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
console.log(localVideo);
console.log(remoteVideo);

navigator.mediaDevices.getUserMedia({
  audio: true,
  video: true
})
.then(gotStream)
.catch(function(e) {
  alert('getUserMedia() error: ' + e.name);
});

function gotStream(stream) {
  console.log('Adding local stream.');
  localStream = stream;
  localVideo.srcObject = stream;
  sendMessage('got user media');
  if (isInitiator) {
    maybeStart();
  }
}

var constraints = {
  video: true
};

console.log('Getting user media with constraints' + constraints);

if (location.hostname !== 'localhost') {
  requestTurn(
    'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
  );
}

function maybeStart() {
  console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady);
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    console.log('>>>>>> creating peer connection');
    createPeerConnection();
    pc.addStream(localStream);
    isStarted = true;
    console.log('isInitiator', isInitiator);
    if (isInitiator) {
      doCall();
    }
  }
}

window.onbeforeunload = function() {
  sendMessage('bye');
};

/////////////////////////////////////////////////////////

function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(null);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
    console.log('Created RTCPeerConnnection');

   var dataChannel = pc.createDataChannel("datachannel", {reliable: false});
    dataChannel.onmessage = function(e){
      document.getElementById("receiveText").innerHTML = e.data;
  };

    dataChannel.onopen = function(){console.log("------ DATACHANNEL OPENED ------");};
    dataChannel.onclose = function(){console.log("------- DC closed! -------")};
    dataChannel.onerror = function(){console.log("DC ERROR!!!")};

    pc.ondatachannel = function (event) {

      var dc = event.channel;
      dc.onmessage = function(e){
        document.getElementById("receiveText").innerHTML = e.data;
    };
    dc.onopen = function(){console.log("------ DATACHANNEL OPENED ------");};
    dc.onclose = function(){console.log("------- DC closed! -------")};
    console.log('peerConnection.ondatachannel event fired.');
  };
    document.getElementById("sendData").onclick = function() {
    var data = document.getElementById("inputText").value;
    console.log("sending message: " + data);
    dataChannel.send(data);
};

  socket.on("translation", (data)=>{
    dataChannel.send(data);
  });


  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.log('End of candidates.');
  }
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function doCall() {
  console.log('Sending offer to peer');
/*  var dataChannelParams = {
    reliable: false
};

var sendChannel = pc.createDataChannel("chat", dataChannelParams);
sendChannel.onmessage = function(event) {
  document.getElementById("receiveText").innerHTML = event.data;
};

pc.ondatachannel = function(event) {
  var receiveChannel = event.channel;
  console.log('Data channel is created!');
  receiveChannel.onmessage = function(e){
    document.getElementById("receiveText").innerHTML = e.data;
  }
  receiveChannel.onopen = function() {
    console.log('Data channel is open and ready to be used.');
  };
  console.log("pc.ondatachannel fired");
};

document.getElementById("sendData").onclick = function() {
    var data = document.getElementById("inputText").value;
    console.log("sending message: " + data);
    sendChannel.send(data);
};*/

  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  // Set Opus as the preferred codec in SDP if Opus is present.
  //  sessionDescription.sdp = preferOpus(sessionDescription.sdp);
  pc.setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function requestTurn(turnURL) {
  var turnExists = false;
  for (var i in pcConfig.iceServers) {
    if (pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
      console.log("TURN EXISTS IT EXIST!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
      turnExists = true;
      turnReady = true;
      break;
    }
  }
  if (!turnExists) {
    console.log('Getting TURN server from ', turnURL);
    // No TURN server. Get one from computeengineondemand.appspot.com:
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        var turnServer = JSON.parse(xhr.responseText);
        console.log('Got TURN server: ', turnServer);
        pcConfig.iceServers.push({
          'urls': 'turn:' + turnServer.username + '@' + turnServer.turn,
          'credential': turnServer.password
        });
        turnReady = true;
      }
    };
    xhr.open('GET', turnURL, true);
    xhr.send();
  }
}

function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  remoteStream = event.stream;
  remoteVideo.srcObject = remoteStream;
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

function hangup() {
  console.log('Hanging up.');
  stop();
  sendMessage('bye');
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  pc.close();
  pc = null;
}

///////////////////////////////////////////

// Set Opus as the default audio codec if it's present.
function preferOpus(sdp) {
  var sdpLines = sdp.split('\r\n');
  var mLineIndex;
  // Search for m line.
  for (var i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('m=audio') !== -1) {
      mLineIndex = i;
      break;
    }
  }
  if (mLineIndex === null) {
    return sdp;
  }

  // If Opus is available, set it as the default in m line.
  for (i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('opus/48000') !== -1) {
      var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
      if (opusPayload) {
        sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex],
          opusPayload);
      }
      break;
    }
  }

  // Remove CN in m line and sdp.
  sdpLines = removeCN(sdpLines, mLineIndex);

  sdp = sdpLines.join('\r\n');
  return sdp;
}

function extractSdp(sdpLine, pattern) {
  var result = sdpLine.match(pattern);
  return result && result.length === 2 ? result[1] : null;
}

// Set the selected codec to the first in m line.
function setDefaultCodec(mLine, payload) {
  var elements = mLine.split(' ');
  var newLine = [];
  var index = 0;
  for (var i = 0; i < elements.length; i++) {
    if (index === 3) { // Format of media starts from the fourth.
      newLine[index++] = payload; // Put target payload to the first.
    }
    if (elements[i] !== payload) {
      newLine[index++] = elements[i];
    }
  }
  return newLine.join(' ');
}

// Strip CN from sdp before CN constraints is ready.
function removeCN(sdpLines, mLineIndex) {
  var mLineElements = sdpLines[mLineIndex].split(' ');
  // Scan from end for the convenience of removing an item.
  for (var i = sdpLines.length - 1; i >= 0; i--) {
    var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
    if (payload) {
      var cnPos = mLineElements.indexOf(payload);
      if (cnPos !== -1) {
        // Remove CN payload from m line.
        mLineElements.splice(cnPos, 1);
      }
      // Remove CN line in sdp
      sdpLines.splice(i, 1);
    }
  }

  sdpLines[mLineIndex] = mLineElements.join(' ');
  return sdpLines;
}
