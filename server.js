// NodeJS libraries
var express = require('express');
var app = express();
var mongoClient = require('mongodb').MongoClient;
var expressMongoDb = require('express-mongo-db');
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt');
var emailValidator = require("email-validator");
var randomString = require("randomstring");
var fs = require('fs');

var config = require('./config.js');
var collections = require('./collections.js');

// Response codes
var RESPONSE_SUCCESS 	= 1;
var RESPONSE_FAIL		= 0;
var RESPONSE_BAD_TOKEN	= -1;
var RESPONSE_BAD_IMAGE	= -2;

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

var newTag = function(req, player) {
	return {
		userId : player._id,
		imageId : ObjectId(req.body.imageId),
		ip : req.ip,
		tags : req.body.tags
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

var getPlayerFromToken = function(token, db, callback) {
	if (!validToken(token)) return null;

	var players = db.collection(collections.players);
	var playerId = tokenToObjectId(token);
	var player = null;

	// Find player's account based on token
	players.findOne({ _id : playerId, token : token }, callback);
}

// Use body parser for request handling
app.use(bodyParser.json());

// Enable MongoDB for routes
app.use(expressMongoDb(config.mongo_url));

// Debug request logging
if (config.debug) {
	app.use(function (req, res, next) {
		console.log(req.method + ' ' + req.path + ' - ' + req.ip);
		next();
	});

	app.get('/users', function(req, res) {
		var players = req.db.collection(collections.players);
		players.find().toArray(function(err, results) {
			assert.equal(err, null);
			res.json(results);
		});
	});

	app.get('/tags', function(req, res) {
		var tags = req.db.collection(collections.tags);
		tags.find().toArray(function(err, results) {
			assert.equal(err, null);
			res.json(results);
		});
	});
}

// Routes
app.get('/', function(req, res) {
	res.send("STGServer is running");
});

/*
	Account registration
*/
app.post('/register', function(req, res) {
	var players = req.db.collection(collections.players);

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
	var players = req.db.collection(collections.players);
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
	var token = req.body.token;

	// Load player from db based on session key
	getPlayerFromToken(token, req.db, function(err, player) {
		// Check if player was found
		if (!player) {
			return res.json({
				success : RESPONSE_BAD_TOKEN,
				message : 'Invalid login'
			});
		}

		// Return metadata for an image to player
		var imgNum = Math.floor((Math.random() * 5) + 1);
		res.json({
			success : RESPONSE_SUCCESS,
			imageId : "12345678901" + imgNum,
			url : config.api_url + '/getimage/' + imgNum
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

/*
	Tag submission
*/
app.post('/submittags', function(req, res) {
	var token = req.body.token;
	var tags = req.db.collection(collections.tags);

	// Load player from db based on session key
	getPlayerFromToken(token, req.db, function(err, player) {
		// Check if player was found
		if (!player) {
			return res.json({
				success : RESPONSE_BAD_TOKEN,
				message : 'Invalid login'
			});
		}

		// TODO: Check if image exists

		// Insert tags
		var tag = newTag(req, player);

		tags.insertOne(tag, function(err, result) {
			if (!result) return;

			// TODO: Score calculation
		});

		res.json({
			success : RESPONSE_SUCCESS,
			message : 'Shark tags submitted'
		});
	});
});

// Begin listening for connections
app.listen(config.port, '0.0.0.0', function() {
	console.log('Listening for HTTP requests on port ' + config.port);
});