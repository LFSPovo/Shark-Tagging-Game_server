// NodeJS libraries
var express 			= require('express');
var app 				= express();
var mongoClient 		= require('mongodb').MongoClient;
var expressMongoDb 		= require('express-mongo-db');
var assert 				= require('assert');
var ObjectId 			= require('mongodb').ObjectID;
var bodyParser 			= require('body-parser');
var bcrypt 				= require('bcrypt');
var emailValidator 		= require("email-validator");
var randomString 		= require("randomstring");
var fs 					= require('fs');
var morgan 				= require('morgan');
var mongoose 			= require('mongoose');

// Enable float/double support for Mongoose
require('mongoose-double')(mongoose);

var config 				= require('./config.js');
var collections 		= require('./collections.js');

var Player 				= require('./models/player.js');
var Tag 				= require('./models/tag.js');
var TaggedImage  		= require('./models/tagged_image.js');

// Response codes
var RESPONSE_SUCCESS 	= 1;
var RESPONSE_FAIL		= 0;
var RESPONSE_BAD_TOKEN	= -1;
var RESPONSE_BAD_IMAGE	= -2;

var validToken = function(token) {
	// Token length always 48 chars. 
	// First 24 chars = player object id
	// Second 24 chars = random session key
	return token != null && token.length == 48;
}

var tokenToObjectId = function(token) {
	if (!validToken(token))
		return null;
	return ObjectId(token.substring(0, 24));
}

// Connect to configured database
mongoose.connect(config.mongo_url);

// Use body parser for request handling
app.use(bodyParser.json());

// Enable MongoDB for routes
app.use(expressMongoDb(config.mongo_url));

// Debug request logging
if (config.debug) {
	app.use(morgan('dev'));

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

	app.get('/tagged_images', function(req, res) {
		var tags = req.db.collection(collections.tagged_images);
		tags.find().toArray(function(err, results) {
			assert.equal(err, null);
			res.json(results);
		});
	});
}
else
	app.use(morgan('combined'));

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

		var newPlayer = new Player({
			username: req.body.username.toLowerCase(),
			email: req.body.email.toLowerCase(),
			password: bcrypt.hashSync(req.body.password, 8),
			ip: req.ip,
			tutorialFinished: false,
			token: null
		});

		// Create new account
		newPlayer.save(function(err) {
			if (err) {
				return res.json({
					success : RESPONSE_FAIL,
					message : 'Registration unsuccessful'
				});
			}

			res.json({
				success : RESPONSE_SUCCESS,
				message : 'Registration successful'
			});
			console.log('Inserted a new player account: ' + req.body.username);
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

	var login = false;

	Player.find(query, function(err, players) {
		for (var i = 0; i < players.length; i++) {
			var player = players[i];

			if (bcrypt.compareSync(req.body.password, player.password)) {
				var login = true;

				// Generate a token key for later communication
				player.token = player._id.valueOf() + randomString.generate(24);

				// Update player's account with session token
				player.save(function(err) {
					// Return login success and token
					return res.json({
						success: RESPONSE_SUCCESS,
						token: player.token,
						message: 'Login successful',
						username: player.username,
						tutorialFinished: player.tutorialFinished
					});
				});
			}
		}

		if (err || !login) {
			res.json({
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
	Player.findOne({ _id: tokenToObjectId(token), token: token }, 
		function(err, player) {
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
	Player.findOne({ _id: tokenToObjectId(token), token: token }, 
		function(err, player) {
		// Check if player was found
		if (!player) {
			return res.json({
				success : RESPONSE_BAD_TOKEN,
				message : 'Invalid login'
			});
		}

		// TODO: Check if image exists

		// Tagged image metadata
		var taggedImage = new TaggedImage({
			playerId: player._id,
			imageId: ObjectId(req.body.imageId),
			ip: req.ip
		});

		taggedImage.save(function (err) {
			if (err) {
				return res.json({
					success : RESPONSE_FAIL,
					message : 'Shark tags submittion failed'
				});
			}

			// Insert each of the tags
			for (var i = 0; i < req.body.tags.length; i++) {
				var tag = new Tag({
					taggedImageId: taggedImage._id,
					sharkId: req.body.tags[i].sharkId,
					posX: req.body.tags[i].position.x,
					posY: req.body.tags[i].position.y,
					sizeX: req.body.tags[i].size.x,
					sizeY: req.body.tags[i].size.y
				});
				tag.save();
			}

			res.json({
				success : RESPONSE_SUCCESS,
				message : 'Shark tags submitted'
			});
		});
	});
});

/*
	Tutorial complete. Update player flag
*/
app.post('/finishtutorial', function(req, res) {
	var token = req.body.token;

	Player.findOne({
		_id: tokenToObjectId(token),
		token: token
	}, function(err, player) {
		if (!player) {
			return res.json({
				success: RESPONSE_BAD_TOKEN,
				message: 'Invalid login'
			});
		}

		// Update flag and save document
		player.tutorialFinished = true;
		player.save();

		return res.json({
			success: RESPONSE_SUCCESS,
			message: 'Tutorial completed'
		});
	});
});

// Begin listening for connections
app.listen(config.port, '0.0.0.0', function() {
	console.log('Listening for HTTP requests on port ' + config.port);
});