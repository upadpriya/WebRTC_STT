

 // [START speech_streaming_recognize]
 const fs = require('fs');
 const exec = require('child_process').exec;
 // Imports the Google Cloud client library
 const speech = require('@google-cloud/speech');
 const Translate = require('@google-cloud/translate');
 const record = require('node-record-lpcm16');
 const Storage = require('@google-cloud/storage');
 const idk = require('dotenv').config()
 var http = require("http");
 // Creates a client

  

 const client = new speech.SpeechClient();
 const translate = new Translate();

 process.on("message", (userData)=>{
console.dir("recieved: " + userData);
const languageCode = userData.from;
console.log(languageCode);
const target = userData.to;
console.log(target);
 const encoding = 'LINEAR16';
 const sampleRateHertz = 16000;
 //const languageCode = 'en-US';

 const request = {
   config: {
     encoding: encoding,
     sampleRateHertz: sampleRateHertz,
     languageCode: languageCode,
   },
   interimResults: false, // If you want interim results, set this to true
 };

 // Stream the audio to the Google Cloud Speech API
 const recognizeStream = client
   .streamingRecognize(request)
   .on('error', console.error)
   .on('data', data => {
     console.log(
       `Transcription: ${data.results[0].alternatives[0].transcript}`
     );

     translate
  .translate(data.results[0].alternatives[0].transcript, target)
  .then(results1 => {
    var translations = results1[0];
    translations = Array.isArray(translations)
      ? translations
      : [translations];

    console.log('Translations:');
    translations.forEach((translation, i) => {
      console.log(`${data.results[0].alternatives[0].transcript[i]} => (${target}) ${translation}`);
      process.send(`${data.results[0].alternatives[0].transcript[i]} => (${target}) ${translation}`);
    });
  })
  .catch(err => {
    console.error('ERROR:', err);
  });

   });


   record.start({
    sampleRateHertz: sampleRateHertz,
    threshold: 0.5,
    verbose: false,
    recordProgram:  'arecord', // Try also "arecord" or "sox"
    silence: '10.0'
  
    }).on('error', console.error)
      .pipe(recognizeStream);
 // Stream an audio file from disk to the Speech API, e.g. "./resources/audio.raw"
 
 // [END speech_streaming_recognize]

  });
