var mongoose = require('mongoose');
var collections = require('../collections.js')
var Schema = mongoose.Schema;

module.exports = mongoose.model('Tag', new Schema({
	taggedImageId: String,
	sharkId: Number,
	posX: Schema.Types.Double,
	posY: Schema.Types.Double,
	sizeX: Schema.Types.Double,
	sizeY: Schema.Types.Double,
	awarded: Boolean
}, { collection: collections.tags }));