var mongoClient 	= require('mongodb').MongoClient;
var collections		= require('./collections.js');
var config 	  		= require('./config.js');

mongoClient.connect(config.mongo_url, function(err, db) {
	if (err) throw err;

	// players
	db.collection(collections.players).drop();
	db.createCollection(collections.players);
	db.collection(collections.players).createIndex(
		{ 'username' : 1 }, 
		{ 'unique' : true }
	);
	db.collection(collections.players).createIndex(
		{ 'email' : 1 }, 
		{ 'unique' : true }
	);

	// tags
	db.collection(collections.tags).drop();
	db.createCollection(collections.tags);

	// images
	db.collection(collections.images).drop();
	db.createCollection(collections.images);*/

	// live config
	db.collection(collections.live_config).drop();
	db.collection(collections.live_config).insert({
		currentChunk: 1,
		currentInsertChunk: 1,
		currentInsertCount: 0
	});

	// tagged images
	db.collection(collections.tagged_images).drop();
	db.createCollection(collections.tagged_images);
	db.collection(collections.tagged_images).createIndex(
		{ 
			'imageId' : 1,
			'playerId' : 1
		},
		{ 'unique' : true }
	);
});