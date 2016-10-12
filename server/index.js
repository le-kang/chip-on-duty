var path = require('path');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var request = require('request');
var events = require('events');
var eventEmitter = new events.EventEmitter();
var fs = require('fs');
var async = require('async');
var _ = require('lodash');
var rmdir = require('rmdir');
var config = require('./config');
var visionStream;
var clientPath = path.resolve('client');

app.set('port', (process.env.PORT || 5000));

app.use(express.static(path.resolve('client')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function(req, res) {
  res.sendFile(clientPath + '/index.html');
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
    fs.mkdirSync(clientPath + '/assets/tmp');
    fs.mkdirSync(clientPath + '/assets/tmp/logo');
    fs.mkdirSync(clientPath + '/assets/tmp/product');
    var activity = JSON.parse(body).activity;
    var assetsJobs = [];
    assetsJobs.push(function(callback) {
      request
        .get(config.webServer + '/api/Containers/' + activity.shopkeeper.id + '/download/' + activity.shopkeeper.logo)
        .pipe(fs.createWriteStream(clientPath + '/assets/tmp/logo/' + activity.shopkeeper.logo))
        .on('finish', function() {
          callback(null, true);
        });
    });
    _.forEach(activity.product.images, function(image) {
      assetsJobs.push(function(callback) {
        request
          .get(config.webServer + '/api/Containers/' + activity.product.id + '/download/' + image)
          .pipe(fs.createWriteStream(clientPath + '/assets/tmp/product/' + image))
          .on('finish', function() {
            callback(null, true);
          });
      });
    });
    async.parallel(assetsJobs, function(err) {
      if (err) return res.sendStatus(500);
      res.status(httpResponse.statusCode).send(body);
      if (httpResponse.statusCode == 200) {
        eventEmitter.emit('start-streaming');
      }
    });
  });
});

app.post('/survey-result', function(req, res) {
  request.post({
    url: config.webServer + '/api/Activities/addSurveyResult',
    form: {
      id: req.body.id,
      result: req.body.result,
      key: config.token
    }
  }, function(err, httpResponse, body) {
    if (err) return res.sendStatus(500);
    res.status(httpResponse.statusCode).send(body);
  })
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
      rmdir(clientPath + '/assets/tmp');
    }
  });
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
