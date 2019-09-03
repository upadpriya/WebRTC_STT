'use strict';

const port = 8081;
const CP = require('child_process');
var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');
var fs = require('fs');
var Connect = require('connect');
const shell = require('shelljs');
var express = require('express');
var app2 = express(); 
var bodyParser = require("body-parser");
var path = require('path');
var router = express.Router();

app2.use(bodyParser.urlencoded({ extended: false }));
app2.use(bodyParser.json());


var app = http.createServer(app2);
var io = socketIO.listen(app);

app2.use( express.static(__dirname));



app.listen(port);


io.sockets.on('connection', function(socket) {
 
  // convenience function to log server messages on the client
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }
  

  socket.on('message', function(message) {
    log('Client said: ', message);
    // for a real app, would be room-only (not broadcast)
    socket.broadcast.emit('message', message);
  });

  app2.post('/', function(req, res){

    var lang = req.body.mytext;
    var trans = req.body.mytext2;
    //console.log( "From: " + req.body.mytext + "To:" + req.body.mytext2);
     var child = CP.fork('new2.js');
    child.send({from : lang, to : trans});
    //res.send(lang);
    child.on("message", data => {
  
        socket.emit("translation", data);
  
    });
  });

  socket.on('create or join', function(room) {
    log('Received request to create or join room ' + room);
    
    

    var clientsInRoom = io.sockets.adapter.rooms[room];
  
    var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
    

    log('Room ' + room + ' now has ' + numClients + ' client(s)');

    if (numClients === 0) {
      socket.join(room);
      log('Client ID ' + socket.id + ' created room ' + room);
      socket.emit('created', room, socket.id);

    } else if (numClients === 1) {
     
      log('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('join', room);
      socket.join(room);
      socket.emit('joined', room, socket.id);
      io.sockets.in(room).emit('ready');
    } else { // max two clients
     
      socket.emit('full', room);
    }
  }, );

  socket.on('ipaddr', function() {
    console.log('in ipaddr');
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
      ifaces[dev].forEach(function(details) {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });


});
