var WEB_PORT = 	8080;
var MONGO_URL =	'mongodb://localhost:27017/test';
var PLAYER_COL = 'players';
var LOGIN_TOKEN_COL = 'login_tokens';

// NodeJS libraries
var express = require('express');
var app = express();
var cookieParser = require('cookie-parser');
var session = require('express-session');
var mongoClient = require('mongodb').MongoClient;
var expressMongoDb = require('express-mongo-db');
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt');
var emailValidator = require("email-validator");
var randomString = require("randomstring");

var newPlayer = function(req) {
	var hashPassword = bcrypt.hashSync(req.body.password, 8);
	return {
		username : req.body.username,
		email : req.body.email,
		password : hashPassword
	};
}

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

// Enable MongoDB for routes
app.use(expressMongoDb(MONGO_URL));

// Routes
app.get('/', function(req, res) {
	res.send("Hello World. Session ID: " + req.sessionID);
});

app.get('/users', function(req, res) {
	var players = req.db.collection(PLAYER_COL);
	players.find().toArray(function(err, results) {
		assert.equal(err, null);
		res.json(results);
	});
});

app.post('/register', function(req, res) {
	var players = req.db.collection(PLAYER_COL);

	// Check for existing player accounts with same username/email
	players.findOne({
		$or: [{ username : req.body.username },{ email : req.body.email }]
	}, function(err, doc) {
		if (doc) {
			// Account exists
			res.json({
				success : 0,
				message : 'The username or email is already registered'
			});
			return;
		}

		// Create new account
		players.insertOne(newPlayer(req), function(err, result) {
			assert.equal(err, null);
			
			if (!err) {
				res.json({
					success : 1,
					message : 'Registration successful'
				});
				console.log('Inserted a new player account');
			}
			else {
				res.json({
					success : 0,
					message : 'Registration unsuccessful'
				});
				console.log('Failed to insert a new player account');
			}
		});
	});
});

app.post('/login', function (req, res) {
	var players = req.db.collection(PLAYER_COL);
	var query = {};

	// Check if username is an email address
	if (emailValidator.validate(req.body.username))
		query.email = req.body.username; // Compare against account email
	else
		query.username = req.body.username;	// Compare against account username

	var cursor = players.find(query);
	var login = false;
	// Check all matching accounts for correct password
	cursor.each(function(err, doc) {
		assert.equal(err, null);

		if (!login) {
			if (doc) {
				if (bcrypt.compareSync(req.body.password, doc.password)) {
					login = true;
					var token = doc._id.valueOf() + randomString.generate(24);
					res.json({
						success : 1,
						token : token,
						message : 'Login successful',
						username : doc.username
					});
					console.log(doc.username + ' logged in');
				}
			}
			else res.json({
				success : 0,
				token : 0,
				message : 'Username or password incorrect'
			});
		}
	});
});

// Begin listening for connections
app.listen(WEB_PORT, function() {
	console.log('Listening for HTTP requests on port ' + WEB_PORT);
});
