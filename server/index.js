var path = require('path');
var express = require('express');
var app = express();

app.set('port', (process.env.PORT || 8080));

app.use(express.static(path.resolve('client')));

app.get('/', function(req, res) {
  res.sendFile(path.resolve('client/index.html'));
});

app.listen(app.get('port'));
