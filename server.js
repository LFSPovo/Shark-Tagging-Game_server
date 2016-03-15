// NodeJS libraries
var express 			= require('express');
var app 				= express();
var mongoClient 		= require('mongodb').MongoClient;
var assert 				= require('assert');
var ObjectId 			= require('mongodb').ObjectID;
var bodyParser 			= require('body-parser');
var bcrypt 				= require('bcrypt');
var emailValidator 		= require("email-validator");
var randomString 		= require("randomstring");
var fs 					= require('fs');
var morgan 				= require('morgan');
var mongoose 			= require('mongoose');
var nodemailer			= require('nodemailer');

// Enable float/double support for Mongoose
require('mongoose-double')(mongoose);

var config 				= require('./config.js');
var collections 		= require('./collections.js');

var Player 				= require('./models/player.js');
var Tag 				= require('./models/tag.js');
var TaggedImage  		= require('./models/tagged_image.js');
var Image 				= require('./models/image.js');
var LiveConfig 			= require('./models/live_config.js');

// Response codes
var RESPONSE_SUCCESS 	= 1;
var RESPONSE_FAIL		= 0;
var RESPONSE_BAD_TOKEN	= -1;
var RESPONSE_BAD_IMAGE	= -2;
var RESPONSE_NO_IMAGES	= -3;

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

var validObjectId = function(id) {
	return id != null && id.length == 24;
}

// Connect to configured database
mongoose.connect(config.mongo_url);

// Use body parser for request handling
app.use(bodyParser.json());

// Enable request logging
app.use(morgan('dev'));

// Debug request logging
if (config.debug) {
	app.get('/users', function(req, res) {
		Player.find(function(err, results) {
			res.json(results);
		});
	});

	app.get('/tags', function(req, res) {
		Tag.find(function(err, results) {
			res.json(results);
		});
	});

	app.get('/tagged_images', function(req, res) {
		TaggedImage.find(function(err, results) {
			res.json(results);
		});
	});

	app.get('/images', function(req, res) {
		Image.find(function(err, results) {
			res.json(results);
		});
	});

	app.get('/liveconfig', function(req, res) {
		LiveConfig.find(function(err, results) {
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
	// Check for missing inputs
	if (req.body.username == null ||
		req.body.email == null ||
		req.body.password == null) {
		return res.json({
			success: RESPONSE_FAIL,
			message: 'Missing username, email or passwrd'
		});
	}

	// Check for existing player accounts with same username/email
	Player.findOne({ 
		$or: [ { username: req.body.username }, { email: req.body.email } ]},
		{ _id: 1 }, 
		function(err, player) {
		if (player) {
			// Account exists
			return res.json({
				success: RESPONSE_FAIL,
				message: 'The username or email is already registered'
			});
		}

		if (!emailValidator.validate(req.body.email)) {
			return res.json({
				success: RESPONSE_FAIL,
				message: 'Invalid email address'
			});
		}

		var newPlayer = new Player({
			username: req.body.username,
			email: req.body.email,
			password: bcrypt.hashSync(req.body.password, 8),
			ip: req.ip,
			tutorialFinished: false,
			chunk: 1,
			token: null,
			recoveryCode: null,
			activationCode: randomString.generate(6),
			score: 0
		});

		// Create new account
		newPlayer.save(function(err) {
			if (err) {
				return res.json({
					success: RESPONSE_FAIL,
					message: 'Registration unsuccessful'
				});
			}

			// Email activation link
			var transporter = nodemailer.createTransport();
			var mailOptions = {
				from: '"' + config.game_name + '" <no-reply@' + req.hostname 
					+'>',
				to: newPlayer.email,
				subject: 'Account activation',
				html: '<p>Hello, ' + newPlayer.username + '</p><br>'
					+ '<p>Thank you for registering a player account. '
					+ 'Please click the activation link to active your account: <b>' 
					+ config.api_url + '/activate/' + newPlayer.username + '/' 
					+ newPlayer.activationCode
					+ '</b><br><p>' + config.game_name + '</p>'

			};

			// Send recovery code email
			transporter.sendMail(mailOptions, function(err, info) {
				if (err) console.log(err);
			});

			res.json({
				success: RESPONSE_SUCCESS,
				message: 'Registration successful\n' +
					'Please check your email to activate your account'
			});
			console.log('Inserted a new player account: ' + req.body.username);
		});
	});
});

/*
	Login authentication. Returns a session token key for communication
*/
app.post('/login', function (req, res) {
	// Check for missing inputs
	if (req.body.username == null ||
		req.body.password == null) {
		return res.json({
			success: RESPONSE_FAIL,
			message: 'Missing username, email or password'
		});
	}
	var query = {};

	// MongoDB queries are case-sensitive
	//req.body.username = req.body.username.toLowerCase();

	// Check if username is an email address
	if (emailValidator.validate(req.body.username))
		query.email = new RegExp(req.body.username, 'i');
	else
		query.username = new RegExp(req.body.username, 'i');

	var login = false;

	// Find players with matching username/email
	Player.find(query, function(err, players) {
		for (var i = 0; players.length; i++) {
			if (!players[i]) break;

			var player = players[i];

			if (bcrypt.compareSync(req.body.password, player.password)) {
				var login = true;

				if (player.activationCode != null) {
					return res.json({
						success: RESPONSE_FAIL,
						message: 'Account not activated. Please check your email'
					});
				}

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
						tutorialFinished: player.tutorialFinished,
						score: player.score
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

		// Load live config data to find out which chunk the server is at
		LiveConfig.findOne(function(err, liveConfig) {
			var serverChunk = liveConfig.currentChunk;

			// Player is way behind on chunks. 
			// Bring them up to the current chunk
			if (serverChunk > player.chunk) {
				player.chunk = server.chunk;
				player.save();
			}

			// Pull a list of image IDs the player has tagged
			TaggedImage.find({ playerId: player._id }, { imageId: 1, _id: 0 },
				function(err, taggedImages) {
				var taggedIds = [];

				// Create an array of image ID values ONLY
				for (var i = 0; i < taggedImages.length; i++)
					taggedIds.push(taggedImages[i].imageId);

				// Find the next unseen image for the player
				Image.findOne({ chunk: player.chunk, _id: { $nin: taggedIds } }, 
					function(err, image) {
					if (!image) {
						// No more images left
						return res.json({
							success: RESPONSE_NO_IMAGES,
							message: 'There are no images to tag!'
						});
					}

					// Return image metadata
					res.json({
						success: RESPONSE_SUCCESS,
						imageId: image._id,
						url : config.api_url + '/getimage/' + image._id
					});
				});
			});
		});
	});
});

/*
	Returns a JPEG image using HTTP
*/
app.get('/getimage/:id', function(req, res) {
	// Check for ID validity
	if (!validObjectId(req.params.id)) {
		return res.json({
			success: RESPONSE_FAIL,
			message: 'Invalid image ID'
		});
	}

	// Find image from supplied image ID
	Image.findOne({ _id: ObjectId(req.params.id) }, function(err, image) {
		fs.readFile(config.image_path + image.folder + '/' + image.imageFile, 
			function(err, data) {
			if (err) {
				return res.json({
					success: RESPONSE_FAIL,
					message: 'Unknown image ID'
				});
			}
			res.writeHead(200, { 'Content-Type': 'image/jpeg' });
			res.end(data);
		});
	});
});

/*
	Tag submission
*/
app.post('/submittags', function(req, res) {
	var token = req.body.token;

	// Load player from db based on session key
	Player.findOne({ _id: tokenToObjectId(token), token: token }, 
		function(err, player) {
		// Check if player was found
		if (!player) {
			return res.json({
				success: RESPONSE_BAD_TOKEN,
				message: 'Invalid login'
			});
		}

		// Check for a valid image ID
		if (!validObjectId(req.body.imageId)) {
			return res.json({
				success: RESPONSE_FAIL,
				message: 'Invalid image ID'
			});
		}

		// Check if image exists
		Image.findOne({ _id: ObjectId(req.body.imageId) }, { _id: 1 }, 
			function(err, image) {
			if (!image) {
				return res.json({
					success: RESPONSE_FAIL,
					message: 'Unknown image ID'
				});
			}

			// Tagged image metadata
			var taggedImage = new TaggedImage({
				playerId: player._id,
				imageId: ObjectId(req.body.imageId),
				ip: req.ip
			});

			// TODO: Check if all images in current chunk have 5 tags min

			// Score calculation
			if (req.body.tags.length > 0) {
				player.score += config.points_per_image;
				player.save();
			}

			taggedImage.save(function (err) {
				if (err) {
					return res.json({
						success : RESPONSE_FAIL,
						message : 'Shark tags submittion failed'
					});
				}

				// Recalculate player chunk number
				TaggedImage.count({
					playerId: player._id,
				}, function(err, count) {
					player.chunk = parseInt(count / config.chunk_size) + 1;
					player.save();
				});

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
					success: RESPONSE_SUCCESS,
					message: 'Shark tags submitted',
					score: player.score
				});
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

/*
	Autologin token check
*/
app.post('/autologin', function(req, res) {
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

		return res.json({
			success: RESPONSE_SUCCESS,
			message: 'Login successful',
			score: player.score
		});
	});
});

/*
	Logout request
*/
app.post('/logout', function(req, res) {
	var token = req.body.token;

	Player.findOne({
		_id: tokenToObjectId(token),
		token: token
	}, function(err, player) {
		if (!player) {
			return res.json({
				success: RESPONSE_BAD_TOKEN,
				message: 'Invalid token'
			});
		}

		player.token = null;
		player.save(function(err) {
			return res.json({
				success: RESPONSE_SUCCESS,
				message: 'Logout successful'
			});
		});
	});
});

/*
	Recover password
*/
app.post('/recoverpassword', function(req, res) {
	// Check for missing inputs
	if (req.body.username == null) {
		return res.json({
			success: RESPONSE_FAIL,
			message: 'Missing username or email'
		});
	}
	var query = {};

	// MongoDB queries are case-sensitive
	//req.body.username = req.body.username.toLowerCase();

	// Check if username is an email address
	if (emailValidator.validate(req.body.username))
		query.email = new RegExp(req.body.username, 'i');
	else
		query.username = new RegExp(req.body.username, 'i');

	// Locate account in the database
	Player.findOne(query, function(err, player) {
		if (!player) {
			return res.json({
				success: RESPONSE_FAIL,
				message: 'Player account not found'
			});
		}

		// Generate a random recovery string
		player.recoveryCode = randomString.generate(6);

		// Update DB entry with recovery code
		player.save(function(err) {
			var transporter = nodemailer.createTransport();
			var mailOptions = {
				from: '"' + config.game_name + '" <no-reply@' + req.hostname 
					+'>',
				to: player.email,
				subject: 'Password recovery',
				html: '<p>Hello, ' + player.username + '</p><br>'
					+ '<p>Thank you for requesting to reset your password. '
					+ 'Your password recovery code is <b>' + player.recoveryCode
					+ '</b></p><p>Request IP: <b>' + req.ip + '</b></p>'
					+ '<p>' + config.game_name + '</p>'

			};

			// Send recovery code email
			transporter.sendMail(mailOptions, function(err, info) {
				if (err) console.log(err);
			});

			res.json({
				success: RESPONSE_SUCCESS,
				username: player.username,
				message: 'Details have been sent to\n' + player.email
			});
		});
	});
});

/*
	Step 2 of password recovery. Password change
*/
app.post('/recoverpasswordchange', function(req, res) {
	// Check for missing inputs
	if (req.body.username == null ||
		req.body.password == null ||
		req.body.code == null) {
		return res.json({
			success: RESPONSE_FAIL,
			message: 'Missing username, password or recovery code'
		});
	}

	// Find player with recovery code
	Player.findOne({
		username: req.body.username,
		recoveryCode: req.body.code
	}, function(err, player) {
		if (!player) {
			return res.json({
				success: RESPONSE_FAIL,
				message: 'Player account not found'
			});
		}

		// Update new details
		player.password = bcrypt.hashSync(req.body.password, 8);
		player.recoveryCode = null;

		player.save(function(err) {
			res.json({
				success: RESPONSE_SUCCESS,
				message: 'Password changed successfully. You may login now'
			});
		});
	});
});

/*
	Activates a player account
*/
app.get('/activate/:username/:code', function(req, res) {
	// Check for ID validity
	if (req.params.username == null ||
		req.params.code == null) {
		return res.send("Invalid username or activation code");
	}

	Player.findOne({
		username: req.params.username,
		activationCode: req.params.code
	}, function(err, player) {
		if (!player) {
			return res.send("Invalid username or activation code");
		}

		player.activationCode = null;
		player.save(function(err) {
			res.send('Account activated!' +
				' You may now log in with your username and password');
		});
	});
});

/*
	Returns the leaderboard
*/
app.post('/leaderboard', function(req,res) {
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

		Player.find({}, 
			{ _id: 0, username: 1, score: 1 }).sort(
			{ score : 'desc' }).limit(20).exec(function(err, leaderBoard) {



			res.json({
				success: 1,
				leaderboard: leaderBoard
			});
		});
	});
});

// Begin listening for connections
app.listen(config.port, '0.0.0.0', function() {
	console.log('Listening for HTTP requests on port ' + config.port);
});