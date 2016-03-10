var mongoose = require('mongoose');
var collections = require('../collections.js')
var Schema = mongoose.Schema;

module.exports = mongoose.model('LiveConfig', new Schema({
	currentChunk: Number,
	currentInsertChunk: Number,
	currentInsertCount: Number
}, { collection: collections.live_config }));