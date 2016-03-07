var mongoose = require('mongoose');
var collections = require('../collections.js')
var Schema = mongoose.Schema;

module.exports = mongoose.model('TaggedImage', new Schema({
	playerId: String,
	imageId: String,
	ip: String
}, { collection: collections.tagged_images }));