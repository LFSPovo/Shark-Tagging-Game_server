var express = require('express');
var app = express();
var cookieParser = require('cookie-parser');
var session = require('express-session');
var mongoClient = require('mongodb').MongoClient;
var assert = require('assert');

// Connect to DB
var url = 'mongodb://localhost:27017/test';
mongoClient.connect(url, function(err, db) {
	assert.equal(null, err);
	console.log('Connected to MongoDB server');
	db.close();
});

// Enable session module and cookies
app.use(cookieParser());
app.use(session({
	secret: '82249F6BAD34493176943E8747CD9',
	resave: false,
	saveUninitialized: true
}));

// Routes
app.get('/', function(req, res) {
	res.send("Hello World. Session ID: " + req.sessionID);
});

app.get('/users', function(req, res) {
	res.json([{ user: 'jerzy' }, { user: 'povilas' }]);
});

// Begin listening for connections
app.listen(8080);
console.log("Listening on port 8080");
