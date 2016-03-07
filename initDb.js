var MONGO_URL =	'mongodb://localhost:27017/test';

var mongoClient 	= require('mongodb').MongoClient;
var collections		= require('./collections.js');

mongoClient.connect(MONGO_URL, function(err, db) {
	if (err) throw err;

	// players
	/*db.collection('players').drop();
	db.createCollection('players');
	db.collection('players').createIndex(
		{ 'username' : 1 }, 
		{ 'unique' : true }
	);
	db.collection('players').createIndex(
		{ 'email' : 1 }, 
		{ 'unique' : true }
	);*/

	// tags
	db.collection(collections.tags).drop();
	db.createCollection(collections.tags);
	db.collection(collections.tagged_images).drop();
	db.createCollection(collections.tagged_images);
	db.collection(collections.tagged_images).createIndex(
		{ 
			'imageId' : 1,
			'playerId' : 1
		},
		{ 'unique' : true },
		function() {
			db.close();
		}
	);
});