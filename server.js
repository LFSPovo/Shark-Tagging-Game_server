var express = require('express');
var app = express();
var cookieParser = require('cookie-parser');
var session = require('express-session');
var mongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
var bodyParser = require('body-parser');

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

// Use body parser for request handling
app.use(bodyParser.urlencoded({
	extended: true
}));

// Routes
app.get('/', function(req, res) {
	res.send("Hello World. Session ID: " + req.sessionID);
});

app.get('/users', function(req, res) {
	var allUsers = function(db, callback) {
		var cursor = db.collection('players').find();
		cursor.each(function(err, doc) {
			assert.equal(err, null);
			if (doc != null)
				console.dir(doc);
			else
				callback();
		});
	};

	mongoClient.connect(url, function(err, db) {
		assert.equal(null, err);
		allUsers(db, function() {
			db.close();
		});
	});
});

app.post('/register', function(req, res) {
	var newPlayer = function(db, callback) {
		db.collection('players').insertOne({
			'username' : req.body.username,
			'email' : req.body.email,
			'password' : req.body.password
		}, function(err, result) {
			assert.equal(err, null);
			console.log('Inserted a new player account');
			callback();
		});
	};

	mongoClient.connect(url, function(err, db) {
		assert.equal(null, err);
		newPlayer(db, function() {
			db.close();
			res.json({
				'success' : 1,
				'message' : 'Registration successful'
			});
		});
	});
});

// Begin listening for connections
app.listen(8080);
console.log("Listening on port 8080");
