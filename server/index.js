var path = require('path');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var request = require('request');
var events = require('events');
var eventEmitter = new events.EventEmitter();
var config = require('./config');
var visionStream;

app.set('port', (process.env.PORT || 5000));

app.use(express.static(path.resolve('client')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function(req, res) {
  res.sendFile(path.resolve('client/index.html'));
});

app.post('/start-activity', function(req, res) {
  request.post({
    url: config.webServer + '/api/Activities/start',
    form: {
      code: req.body.code,
      key: config.token
    }
  }, function(err, httpResponse, body) {
    if (err) return res.sendStatus(500);
    res.status(httpResponse.statusCode).send(body);
    if (httpResponse.statusCode == 200) {
      eventEmitter.emit('start-streaming');
    }
  });
});

app.post('/end-activity', function(req, res) {
  request.post({
    url: config.webServer + '/api/Activities/end',
    form: {
      id: req.body.id,
      key: config.token
    }
  }, function(err, httpResponse, body) {
    if (err) return res.sendStatus(500);
    res.status(httpResponse.statusCode).send(body);
    if (httpResponse.statusCode == 200) {
      eventEmitter.emit('stop-streaming');
    }
  });
});

app.get('/image', function(req, res) {
  request
    .get(config.webServer + '/api/Containers/' + req.query.id + '/download/' + req.query.name)
    .pipe(res);
});

eventEmitter.on('start-streaming', function() {
  visionStream = request
    .get('http://localhost:' + config.streamServerPort + '/stream?topic=' + config.rosImageTopic + '&quality=' + config.streamQuality)
    .on('error', function(err) {
      console.log(err)
    })
    .pipe(request.post(config.webServer + '/chip-vision-stream?token=' + config.token));
});

eventEmitter.on('stop-streaming', function() {
  visionStream.abort();
});

app.listen(app.get('port'));
