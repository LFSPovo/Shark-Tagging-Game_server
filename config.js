module.exports = {
	/*
		Enables debug logging and routes to be enabled
	*/
	debug: true,
	
	/*
		Specifies the port number on which the REST API operates
	*/
	port: 8080,

	/*
		Specifies the MongoDB address to use
	*/
	mongo_url: 'mongodb://localhost:27017/test',

	/*
		Specifies the URL of the REST API to be used for requests
	*/
	api_url: 'http://povilas.ovh:8080',

	/*
		Specifies the directory in which images should be stored
	*/
	image_path: '/home/sharks/server/images/',

	/*
		Specifies the number of images that should be contained inside a chunk
	*/
	chunk_size: 100,

	/*
		Specifies the user-friendly game name
	*/
	game_name: 'Shark Tagging Game',

	/*
		Specifies the number of points a player should get for tagging an image
	*/
	points_per_image: 1,

	/*
		Specifies the number of points a player should get for a successful tag
	*/
	points_per_tag: 5,

	/*
		Specifies the minimum number of times image has to be tagged by 
		different people to award points

		AND

		the number of minimum number of matching shark species for a group of 
		matching tags
	*/
	min_tagged_images: 5,

	/*
		Specifies the maximum of how far (in pixels) a tag can be from another 
		tag for it to be considered overlapping
	*/
	tag_overlap_threshold: 50
};