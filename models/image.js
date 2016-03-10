var mongoose = require('mongoose');
var collections = require('../collections.js')
var Schema = mongoose.Schema;

module.exports = mongoose.model('Image', new Schema({
	chunk: Number,
	folder: String,
	imageFile: String,
	testImage: Boolean
}, { collection: collections.images }));