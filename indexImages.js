// NodeJS libraries
var mongoClient 		= require('mongodb').MongoClient;
var ObjectId 			= require('mongodb').ObjectID;
var fs 					= require('fs');
var mongoose 			= require('mongoose');
var path 				= require('path');

// Enable float/double support for Mongoose
require('mongoose-double')(mongoose);

var config 				= require('./config.js');
var collections 		= require('./collections.js');

var Image 				= require('./models/image.js');
var LiveConfig			= require('./models/live_config.js');

// Connect to configured database
mongoose.connect(config.mongo_url);

// Directory name for storing this batch
var timestamp = Math.floor(Date.now() / 1000);
var processed = 0;

fs.mkdirSync(config.image_path + timestamp);

LiveConfig.findOne(function(err, liveConfig) {
	for (var i = 2; i < process.argv.length; i++) {
		var filePath = process.argv[i];
		var newFilePath = config.image_path + 
			timestamp + '/' + 
			path.basename(filePath);

		// Move image to required directory
		fs.renameSync(filePath, newFilePath);
		
		// Create an index data for image
		var img = new Image({
			chunk: liveConfig.currentInsertChunk,
			folder: timestamp,
			imageFile: path.basename(newFilePath),
			testImage: false
		});

		// Check chunk size
		liveConfig.currentInsertCount++;
		if (liveConfig.currentInsertCount >= config.chunk_size) {
			liveConfig.currentInsertChunk++;
			liveConfig.currentInsertCount = 0;
		}

		// Save index data
		img.save(function(err) {
			processed++;

			console.log('Inserted ' + processed + ' images');
				
			// Check if all async saves are finished
			if (processed == process.argv.length - 2) {
				liveConfig.save(function(err) {
					console.log('Updated live config');
					process.exit();
				});
			}
		});
	}
});
