var MONGO_URL =	'mongodb://localhost:27017/test';

var mongoClient = require('mongodb').MongoClient;

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
	db.collection('tags').drop();
	db.createCollection('tags');
	db.collection('tags').createIndex(
		{ 
			'imageId' : 1,
			'userId' : 1
		},
		{ 'unique' : true },
		function() {
			db.close();
		}
	);
});