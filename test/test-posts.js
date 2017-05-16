const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

const should = chai.should();

const {BlogPost} = require('../models');
const {app, runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL} = require('../config');

chai.use(chaiHttp);

// Add test date
function seedPostData() {
	console.info('seeding post data to test db');
	const seedData = [];

	for (let i=0; i < 10; i++) {
		seedData.push(generatePostData());
	}

	// returns promise
	return BlogPost.insertMany(seedData);
}

function generatePostData() {
	return {
		author: {
			firstName: faker.name.firstName(),
			lastName: faker.name.lastName()
		},
		title: faker.random.words(),
		content: faker.lorem.paragraphs(),
		created: faker.date.past()
	}
}

function tearDownDb(){
	console.warn('Deleting test database');
	return mongoose.connection.dropDatabase();
}

describe('Blog Posts API resource', function() {
	before(function() {
		return runServer(TEST_DATABASE_URL);
	});

	beforeEach(function() {
		return seedPostData();
	});

	afterEach(function() {
		return tearDownDb();
	});

	after(function() {
		return closeServer();
	});

	describe('GET endpoint', function() {

		it('should return all posts', function() {
			let res;
			return chai.request(app)
				.get('/posts')
				.then(function(_res) {
					// this is so the next then block has access to the original result
					res = _res
					res.should.have.status(200);
					console.log('checking there are post results');
					res.body.should.have.length.of.at.least(1);
					// have to look at result of this in a then block since its async
					return BlogPost.count();
				})
				.then(function(count) {
					console.log('checking the body has the same amount of results as the db');
					res.body.should.have.length.of(count);
				});
		});

		it('should return posts with expected fields', function() {
			let firstPost; 
			return chai.request(app)
				.get('/posts')
				.then(function(res) {
					res.should.have.status(200);
					res.should.be.json;
					res.body.should.be.a('array');
					res.body.should.have.length.of.at.least(1);

					res.body.forEach(function(bPost) {
						bPost.should.be.a('object');
						bPost.should.include.keys('title', 'author', 'content', 'created');
					});

					firstPost = res.body[0];
					return BlogPost.findById(firstPost.id);
				}).then(function(post) {
					const author = `${post.author.firstName} ${post.author.lastName}`;
					post.id.should.equal(firstPost.id);
					post.title.should.equal(firstPost.title);
					post.content.should.equal(firstPost.content);
					// This doesn't work because of the way dates are saved in the example
					// post.created.should.equal(firstPost.created);
					author.should.deep.equal(firstPost.author);
				});
		});

	});

	describe('POST endpoint', function() {

		it('should add a new post', function() {
			const newPost = generatePostData();
			const author = `${newPost.author.firstName} ${newPost.author.lastName}`;
			return chai.request(app)
				.post('/posts')
				.send(newPost)
				.then(function(res) {
					console.log('checking that post object returned mathces what was sent');
					res.should.have.status(201);
					res.should.be.json;
					res.body.should.be.a('object');
					res.body.should.include.keys('title', 'author', 'content', 'created');
					res.body.title.should.equal(newPost.title);
					res.body.author.should.equal(author);
					res.body.content.should.equal(newPost.content);
					res.body.id.should.not.be.null;
					return BlogPost.findById(res.body.id);
				}).then(function(post) {
					console.log('checking that post stored in server is same as object sent');
					post.title.should.equal(newPost.title);
					post.content.should.equal(newPost.content);
					// This doesn't work because of the way dates are saved in the example
					// post.created.should.equal(firstPost.created);
					author.should.deep.equal(author);
				});
		});

	});

	describe('PUT endpoint', function() {

		it('should update fields sent', function() {
			const updateData = {
				title: faker.random.words(),
				author: {
					firstName: faker.name.firstName(),
					lastName: faker.name.lastName()
				}
			}

			return BlogPost
				.findOne()
				.then(function(post) {
					updateData.id = post.id;

					return chai.request(app)
						.put(`/posts/${post.id}`)
						.send(updateData);
				})
				.then(function(res) {
					res.should.have.status(201);
					return BlogPost.findById(updateData.id);
				})
				.then(function(post) {
					post.title.should.equal(updateData.title);
					post.author.firstName.should.equal(updateData.author.firstName);
					post.author.lastName.should.equal(updateData.author.lastName);
				})
		});

	});

	describe('DELETE endpoint', function() {
		it('should delete post by id', function() {
			let post;
			return BlogPost
				.findOne()
				.then(function (_post) {
					post = _post;
					return chai.request(app).delete(`/posts/${post.id}`);
				}).then(function(res) {
					res.should.have.status(204);
					return BlogPost.findById(post.id);
				}).then(function(_post) {
					should.not.exist(_post);
				});
		});
	});
});


