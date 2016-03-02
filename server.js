var DEBUG 		= true;
var WEB_PORT 	= 8080;
var MONGO_URL 	= 'mongodb://localhost:27017/test';
var API_URL		= 'http://povilas.ovh:8080';

// Collections
var PLAYER_COL 	= 'players';

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
var fs = require('fs');

// Response codes
var RESPONSE_SUCCESS 	= 1;
var RESPONSE_FAIL		= 0;
var RESPONSE_BAD_TOKEN	= -1;

var newPlayer = function(req) {
	var hashPassword = bcrypt.hashSync(req.body.password, 8);
	return {
		username : req.body.username.toLowerCase(),
		email : req.body.email.toLowerCase(),
		password : hashPassword,
		token : null,
		ip : req.ip
	};
}

var validToken = function(token) {
	// Token length always 48 chars. 
	// First 24 chars = player object id
	// Second 24 chars = random session key
	return token != null && token.length == 48;
}

var tokenToObjectId = function(token) {
	return ObjectId(token.substring(0, 24));
}

// Enable session module and cookies
app.use(cookieParser());
app.use(session({
	secret: '82249F6BAD34493176943E8747CD9',
	resave: false,
	saveUninitialized: true
}));

// Use body parser for request handling
app.use(bodyParser.json());

// Enable MongoDB for routes
app.use(expressMongoDb(MONGO_URL));

// Debug request logging
app.use(function (req, res, next) {
	if (DEBUG)
		console.log(req.method + ' ' + req.path + ' - ' + req.ip);
	next();
});

// Routes
app.get('/', function(req, res) {
	res.send("STGServer is running");
});

app.get('/users', function(req, res) {
	var players = req.db.collection(PLAYER_COL);
	players.find().toArray(function(err, results) {
		assert.equal(err, null);
		res.json(results);
	});
});

/*
	Account registration
*/
app.post('/register', function(req, res) {
	var players = req.db.collection(PLAYER_COL);

	// Check for existing player accounts with same username/email
	players.findOne({
		$or: [{ username : req.body.username }, { email : req.body.email }]
	}, function(err, doc) {
		if (doc) {
			// Account exists
			res.json({
				success : RESPONSE_FAIL,
				message : 'The username or email is already registered'
			});
			return;
		}

		// Create new account
		players.insertOne(newPlayer(req), function(err, result) {
			assert.equal(err, null);
			
			if (!err) {
				res.json({
					success : RESPONSE_SUCCESS,
					message : 'Registration successful'
				});
				console.log('Inserted a new player account: ' + 
					req.body.username);
			}
			else {
				res.json({
					success : RESPONSE_FAIL,
					message : 'Registration unsuccessful'
				});
				console.log('Failed to insert a new player account');
			}
		});
	});
});

/*
	Login authentication. Returns a session token key for communication
*/
app.post('/login', function (req, res) {
	var players = req.db.collection(PLAYER_COL);
	var query = {};

	// MongoDB queries are case-sensitive
	req.body.username = req.body.username.toLowerCase();

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
					// Player's account found.
					login = true;
					
					// Generate a token key for later communication
					var token = doc._id.valueOf() + randomString.generate(24);
					
					// Update player's account with session token
					players.updateOne({ _id : doc._id }, 
						{ $set : { token : token } }, 
						function(err, result) {
							// Return login success and token
							return res.json({
								success : RESPONSE_SUCCESS,
								token : token,
								message : 'Login successful',
								username : doc.username
							});
						}
					);

					console.log(doc.username + ' logged in');
				}
			}
			else res.json({
				success : RESPONSE_FAIL,
				message : 'Username or password incorrect'
			});
		}
	});
});

/*
	Image request. Returns metadata and URL for an image
*/
app.post('/reqimage', function(req, res) {
	var players = req.db.collection(PLAYER_COL);
	var token = req.body.token;

	if (!validToken(token)) {
		// No token or length is wrong. End request
		return res.json({
			success : RESPONSE_BAD_TOKEN,
			message : 'Invalid session token'
		});
	}

	var playerId = tokenToObjectId(token);

	// Find player's account based on token
	players.findOne({ _id : playerId, token : token }, function(err, doc) {
		if (!doc) {
			return res.json({
				success : RESPONSE_BAD_TOKEN,
				message : 'Invalid login'
			});
		}

		// Return metadata for an image to player
		var imgNum = Math.floor((Math.random() * 5) + 1);
		res.json({
			success : RESPONSE_SUCCESS,
			imageId : imgNum,
			url : API_URL + '/getimage/' + imgNum
		});
	});
});

/*
	Returns a JPEG image using HTTP
*/
app.get('/getimage/:id', function(req, res) {
	fs.readFile('/home/sharks/server/test_images/image' + req.params.id + '.jpg', function(err, data) {
		assert.equal(err, null);

		res.writeHead(200, { 'Content-Type': 'image/jpeg' });
		res.end(data);
	});
});

// Begin listening for connections
app.listen(WEB_PORT, '0.0.0.0', function() {
	console.log('Listening for HTTP requests on port ' + WEB_PORT);
});
