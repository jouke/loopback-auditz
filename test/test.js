var test = require('tap').test;

var path = require('path');
var SIMPLE_APP = path.join(__dirname, 'fixtures', 'simple-app');
var app = require(path.join(SIMPLE_APP, 'server/server.js'));

// The reason we use order: [] is to avoid strongloop/loopback#1525.
// This is only a problem for memory connectors.
var includeDeleted = { deleted: true, order: [] };
// var includeDeleted = { deleted: true };


test('loopback auditz', function(tap) {
  'use strict';

  var Widget = app.models.Widget;

  tap.test('createdAt', function(t) {

    t.test('should exist on create', function(tt) {
      Widget.destroyAll(function() {
        Widget.create({name: 'book 1', type: 'fiction'}, function(err, book) {
          tt.error(err);
          tt.type(book.createdAt, Date);
          tt.equal(book.createdBy, 0);
          tt.equal(book.updatedBy, 0);
          tt.end();
        });
      });
    });

    t.test('should not change on save', function(tt) {
      Widget.destroyAll(function() {
        Widget.create({name:'book 1', type:'fiction'}, function(err, book) {
          tt.error(err);
          tt.type(book.createdAt, Date);
          book.name = 'book inf';
          tt.equal(book.createdBy, 0);
          tt.equal(book.updatedBy, 0);
          book.save(function(err, b) {
            tt.equal(book.createdAt, b.createdAt);
            tt.equal(book.createdBy, 0);
            tt.equal(book.updatedBy, 0);
            tt.end();
          });
        });
      });
    });

    t.test('should not change on update', function(tt) {
      Widget.destroyAll(function() {
        Widget.create({name:'book 1', type:'fiction'}, function(err, book) {
          tt.error(err);
          tt.equal(book.createdBy, 0);
          tt.type(book.createdAt, Date);
          book.updateAttributes({ name:'book inf' }, function(err, b) {
            tt.error(err);
            tt.equal(book.createdAt, b.createdAt);
            tt.equal(book.createdBy, 0);
            tt.end();
          });
        });
      });
    });

    t.test('should not change on upsert', function(tt) {
      Widget.destroyAll(function() {
        Widget.create({name:'book 1', type:'fiction'}, function(err, book) {
          tt.error(err);
          tt.equal(book.createdBy, 0);
          tt.type(book.createdAt, Date);
          Widget.upsert({id: book.id, name:'book inf'}, function(err, b) {
            tt.error(err);
            tt.equal(book.createdAt.getTime(), b.createdAt.getTime());
            tt.equal(book.createdBy, 0);
            tt.end();
          });
        });
      });
    });

    t.test('should not change with bulk updates', function(tt) {
      var createdAt;
      Widget.destroyAll(function() {
        Widget.create({name:'book 1', type:'fiction'}, function(err, book) {
          tt.error(err);
          tt.equal(book.createdBy, 0);
          tt.type(book.createdAt, Date);
          Widget.updateAll({ type:'fiction' }, { type:'non-fiction' }, function(err) {
            tt.error(err);
            Widget.findById(book.id, function(err, b) {
              tt.error(err);
              tt.equal(book.createdAt.getTime(), b.createdAt.getTime());
              tt.equal(book.createdBy, 0);
              tt.end();
            });
          });
        });
      });
    });

    t.end();

  });

  tap.test('updatedAt', function(t) {

    t.test('should exist on create', function(tt) {
      Widget.destroyAll(function() {
        Widget.create({name:'book 1', type:'fiction'}, function(err, book) {
          tt.error(err);
          tt.type(book.updatedAt, Date);
          tt.end();
        });
      });
    });

    t.test('should be updated via updateAttributes', function(tt) {
      var updatedAt;
      Widget.destroyAll(function() {
        Widget.create({name:'book 1', type:'fiction'}, function(err, book) {
          tt.error(err);
          tt.type(book.createdAt, Date);
          updatedAt = book.updatedAt;

          // ensure we give enough time for the updatedAt value to be different
          setTimeout(function pause() {
            book.updateAttributes({ type:'historical-fiction' }, function(err, b) {
              tt.error(err);
              tt.type(b.createdAt, Date);
              tt.ok(b.updatedAt.getTime() > updatedAt.getTime());
              tt.end();
            });
          }, 1);
        });
      });
    });

    t.test('should update bulk model updates at once', function(tt) {
      var createdAt1, createdAt2, updatedAt1, updatedAt2;
      Widget.destroyAll(function() {
        Widget.create({name:'book 1', type:'fiction'}, function(err, book1) {
          tt.error(err);
          createdAt1 = book1.createdAt;
          updatedAt1 = book1.updatedAt;
          setTimeout(function pause1() {
            Widget.create({name:'book 2', type:'fiction'}, function(err, book2) {
              tt.error(err);
              createdAt2 = book2.createdAt;
              updatedAt2 = book2.updatedAt;
              tt.ok(updatedAt2.getTime() >= updatedAt1.getTime());
              setTimeout(function pause2() {
                Widget.updateAll({ type:'fiction' }, { type:'romance' }, function(err, count) {
                  tt.error(err);
                  tt.equal(createdAt1.getTime(), book1.createdAt.getTime());
                  tt.equal(createdAt2.getTime(), book2.createdAt.getTime());
                  Widget.find({ type:'romance' }, function(err, books) {
                    tt.error(err);
                    tt.equal(books.length, 2);
                    books.forEach(function(book) {
                      // because both books were updated in the updateAll call
                      // our updatedAt1 and updatedAt2 dates have to be less than the current
                      tt.ok(updatedAt1.getTime() < book.updatedAt.getTime());
                      tt.ok(updatedAt2.getTime() < book.updatedAt.getTime());
                    });
                    tt.end();
                  });
                });
              }, 1);
            });
          }, 1);
        });
      });
    });

    t.end();

  });

  tap.test('softDeletes turned on', function(t) {
    t.test('count excludes deleted instances by default', function(tt) {
      var Book = app.model('counting_1',
        { properties: { id: { type: Number, generated: false, id: true }, name: String, type: String },
          mixins: { Auditz: true },
          dataSource: 'db'
        }
      );

      Book.create({ id: 1, name: 'book 1', type: 'fiction'});
      Book.create({ id: 2, name: 'book 2', type: 'fiction'});
      Book.create({ id: 3, name: 'book 3', type: 'non-fiction'});

      Book.destroyAll({ type: 'non-fiction' }, function() {
        Book.count({}, function(err, cnt) {
          tt.equal(cnt, 2);
          tt.end();
        });
      });
    });

    t.test('count excludes deleted instances even when a where is supplied', function(tt) {
      var Book = app.model('counting_1',
        { properties: { id: { type: Number, generated: false, id: true }, name: String, type: String },
          mixins: { Auditz: true },
          dataSource: 'db'
        }
      );

      Book.create({ id: 1, name: 'book 1', type: 'fiction'});
      Book.create({ id: 2, name: 'book 2', type: 'fiction'});
      Book.create({ id: 3, name: 'book 3', type: 'non-fiction'});

      Book.destroyById(2, function() {
        Book.count({ type: 'fiction'}, function(err, cnt) {
          tt.equal(cnt, 1);
          tt.end();
        });
      });
    });

    t.test('findOrCreate excludes deleted instances by default', function(tt) {
      var Book = app.model('findOrCreate_1',
        { properties: { id: { type: Number, generated: false, id: true }, name: String, type: String },
          mixins: { Auditz: true },
          dataSource: 'db'
        }
      );

      Book.create({ id: 1, name: 'book 1', type: 'fiction'});
      Book.create({ id: 2, name: 'book 2', type: 'fiction'});
      Book.create({ id: 3, name: 'book 3', type: 'non-fiction'});

      Book.destroyById(2, function() {
        Book.findOrCreate({where: {name: 'book 2'}}, { id: 4, name: 'book 2', type: 'non-fiction'}, function(err, book) {
          tt.notEqual(book, null);
          tt.notEqual(book.id, 2);
          tt.equal(book.type, 'non-fiction');
          tt.end();
        });
      });
    });

    t.test('findOrCreate excludes deleted instances even when where is not supplied', function(tt) {
      var Book = app.model('findOrCreate_2',
        { properties: { id: { type: Number, generated: false, id: true }, name: String, type: String },
          mixins: { Auditz: true },
          dataSource: 'db'
        }
      );

      Book.create({ id: 1, name: 'book 1', type: 'fiction'});
      Book.create({ id: 2, name: 'book 2', type: 'fiction'});
      Book.create({ id: 3, name: 'book 3', type: 'non-fiction'});

      Book.destroyById(2, function() {
        Book.findOrCreate({}, { id: 4, name: 'book 2', type: 'non-fiction'}, function(err, book) {
          tt.notEqual(book, null);
          tt.end();
        });
      });
    });

    t.test('excludes deleted instances by default during queries', function(tt) {
      var Book = app.model('querying_1',
        { properties: { id: { type: Number, generated: false, id: true }, name: String, type: String },
          mixins: { Auditz: true },
          dataSource: 'db'
        }
      );

      Book.create({ id: 1, name: 'book 1', type: 'fiction'});
      Book.create({ id: 2, name: 'book 2', type: 'fiction'});
      Book.create({ id: 3, name: 'book 3', type: 'non-fiction'});

      Book.destroyAll({ type: 'non-fiction' }, function() {
        Book.find({}, function(err, books) {
          tt.equal(books.length, 2);
          tt.equal(books[0].id, 1);
          tt.equal(books[1].id, 2);
          tt.end();
        });
      });
    });

    t.test('includes deleted instances by configuration during queries', function(tt) {
      var Book = app.model('querying_2',
        { properties: { id: { type: Number, generated: false, id: true }, name: String, type: String },
          mixins: { Auditz: true },
          dataSource: 'db'
        }
      );

      Book.create({ id: 1, name: 'book 1', type: 'fiction'});
      Book.create({ id: 2, name: 'book 2', type: 'fiction'});
      Book.create({ id: 3, name: 'book 3', type: 'non-fiction'});

      Book.destroyAll({ type: 'non-fiction' }, function() {
        Book.find(includeDeleted, function(err, books) {
          tt.equal(books.length, 3);
          tt.equal(books[2].id, 3);
          tt.notEqual(books[2].deletedAt, null);
          tt.notEqual(books[2].deletedAt, undefined);
          tt.end();
        });
      });
    });

    t.test('should add a deletedAt property to all matching', function(tt) {
      var Book = app.model('destroyAll_1',
        { properties: { name: String, type: String },
          mixins: { Auditz: true },
          dataSource: 'db'
        }
      );

      Book.create({ name: 'book 1', type: 'fiction'});
      Book.create({ name: 'book 2', type: 'fiction'});
      Book.create({ name: 'book 3', type: 'non-fiction'});

      Book.destroyAll({ type: 'fiction' }, function() {
        Book.find(includeDeleted, function(err, books) {
          tt.notEqual(books[0].deletedAt, null);
          tt.notEqual(books[0].deletedAt, undefined);
          tt.equal(books[0].deletedBy, 0);
          tt.notEqual(books[1].deletedAt, null);
          tt.notEqual(books[1].deletedAt, undefined);
          tt.equal(books[1].deletedBy, 0);
          tt.equal(books[2].deletedAt, undefined);
          tt.end();
        });
      });
    });

    t.test('should add a differently named property if configured', function(tt) {
      var Book = app.model('destroyAll_2',
        { properties: { name: String, type: String },
          mixins: { Auditz: { deletedAt: 'deletedOn' } },
          dataSource: 'db'
        }
      );

      Book.create({ name: 'book 1', type: 'fiction'});
      Book.create({ name: 'book 2', type: 'fiction'});
      Book.create({ name: 'book 3', type: 'non-fiction'});

      Book.destroyAll({ type: 'fiction' }, function() {
        Book.find(includeDeleted, function(err, books) {
          tt.notEqual(books[0].deletedOn, undefined);
          tt.equal(books[0].deletedAt, undefined);
          tt.notEqual(books[1].deletedOn, undefined);
          tt.equal(books[1].deletedAt, undefined);
          tt.equal(books[2].deletedOn, undefined);
          tt.end();
        });
      });
    });

    t.test('should scrub all the non-key fields if configured', function(tt) {
      var Book = app.model('destroyAll_2',
        { properties: { name: String, type: String },
          mixins: { Auditz: { scrub: true } },
          dataSource: 'db'
        }
      );

      Book.create({ name: 'book 1', type: 'fiction'});
      Book.create({ name: 'book 2', type: 'fiction'});
      Book.create({ name: 'book 3', type: 'non-fiction'});

      Book.destroyAll({ type: 'fiction' }, function() {
        Book.find(includeDeleted, function(err, books) {
          tt.notEqual(books[0].id, null);
          tt.notEqual(books[0].deletedAt, null);
          tt.equal(books[0].name, null);
          tt.equal(books[0].type, null);

          tt.notEqual(books[1].id, null);
          tt.notEqual(books[1].deletedAt, null);
          tt.equal(books[1].name, null);
          tt.equal(books[1].type, null);

          tt.equal(books[2].deletedAt, undefined);
          tt.end();
        });
      });
    });

    t.test('should add a deletedAt property to the appropriate instance', function(tt) {
      var Book = app.model('destroyById_1',
        { properties: { id: { type: Number, generated: false, id: true }, name: String, type: String },
          mixins: { Auditz: true },
          dataSource: 'db'
        }
      );

      Book.create({ id: 1, name: 'book 1', type: 'fiction'});
      Book.create({ id: 2, name: 'book 2', type: 'fiction'});
      Book.create({ id: 3, name: 'book 3', type: 'non-fiction'});

      Book.destroyById(1, function() {
        Book.find(includeDeleted, function(err, books) {
          tt.notEqual(books[0].deletedAt, undefined);

          tt.equal(books[1].deletedAt, undefined);
          tt.equal(books[2].deletedAt, undefined);

          tt.end();
        });
      });

    });

    t.test('should add a differently named property if configured', function(tt) {
      var Book = app.model('destroyById_2',
        { properties: { id: { type: Number, generated: false, id: true }, name: String, type: String },
          mixins: { Auditz: { deletedAt: 'deletedOn' } },
          dataSource: 'db'
        }
      );

      Book.create({ id: 1, name: 'book 1', type: 'fiction'});
      Book.create({ id: 2, name: 'book 2', type: 'fiction'});
      Book.create({ id: 3, name: 'book 3', type: 'non-fiction'});

      Book.destroyById(1, function() {
        Book.find(includeDeleted, function(err, books) {
          tt.notEqual(books[0].deletedOn, undefined);
          tt.equal(books[0].deletedAt, undefined);

          tt.equal(books[1].deletedOn, undefined);
          tt.equal(books[1].deletedAt, undefined);
          tt.equal(books[2].deletedOn, undefined);
          tt.equal(books[2].deletedAt, undefined);

          tt.end();
        });
      });

    });

    t.test('should scrub all the non-key fields if configured', function(tt) {
      var Book = app.model('destroyById_3',
        { properties: { id: {type: Number, generated: false, id: true}, name: String, type: String },
          mixins: { Auditz: { scrub: true } },
          dataSource: 'db'
        }
      );

      Book.create({ name: 'book 1', type: 'fiction'});
      Book.create({ name: 'book 2', type: 'fiction'});
      Book.create({ name: 'book 3', type: 'non-fiction'});

      Book.destroyById(2, function() {
        Book.find(includeDeleted, function(err, books) {
          tt.notEqual(books[0].id, null);
          tt.equal(books[0].deletedAt, undefined);
          tt.notEqual(books[0].name, null);
          tt.notEqual(books[0].type, null);

          tt.notEqual(books[1].id, null);
          tt.notEqual(books[1].deletedAt, null);
          tt.equal(books[1].name, null);
          tt.equal(books[1].type, null);

          tt.notEqual(books[2].id, null);
          tt.equal(books[2].deletedAt, undefined);
          tt.notEqual(books[2].name, null);
          tt.notEqual(books[2].type, null);
          tt.end();
        });
      });
    });

    t.test('should add a deletedAt property to the instance', function(tt) {
      var Book = app.model('destroy_1',
        { properties: { id: {type: Number, generated: false, id: true}, name: String, type: String },
          mixins: { Auditz: true },
          dataSource: 'db'
        }
      );

      Book.create({ name: 'book 1', type: 'fiction'}, function(err, book) {
        book.destroy({}, function(err, b) {
          tt.notEqual(b, null);
          tt.notEqual(b.deletedAt, undefined);
          tt.end();
        });
      });

    });

    t.test('should add a differently named property if configured', function(tt) {
      var Book = app.model('destroy_2',
        {
          properties: {id: {type: Number, generated: false, id: true}, name: String, type: String},
          mixins    : {Auditz: {deletedAt: 'deletedOn'}},
          dataSource: 'db'
        }
      );

      Book.create({name: 'book 1', type: 'fiction'}, function (err, book) {
        book.delete({}, function (err, b) {
          tt.notEqual(b, null);
          tt.notEqual(b.deletedOn, undefined);
          tt.end();
        });
      });
    });

    t.test('should scrub all the non-key fields if configured', function(tt) {
      var Book = app.model('destroy_3',
        {
          properties: {id: {type: Number, generated: false, id: true}, name: String, type: String},
          mixins    : {Auditz: { scrub: true}},
          dataSource: 'db'
        }
      );

      Book.create({name: 'book 1', type: 'fiction'}, function (err, book) {
        book.remove({}, function (err, b) {
          tt.equal(b.id, 1);
          tt.equal(b.name, null);
          tt.equal(b.type, null);
          tt.notEqual(b.deletedAt, null);
          tt.notEqual(b.deletedAt, undefined);
          tt.end();
        });
      });
    });

    t.test('should error on invalid call to destroyAll', function(tt) {
      var Book = app.model('destroy_4',
        {
          properties: {id: {type: Number, generated: false, id: true}, name: String, type: String},
          mixins    : {Auditz: { scrub: true}},
          dataSource: 'db'
        }
      );

      Book.destroyAll('wrong', function (err, b) {
        tt.notEqual(err, null);
        tt.end();
      });
    });


    t.end();
  });

  tap.test('softDeletes turned off', function(t) {
    t.test('count excludes deleted instances by default', function(tt) {
      var Book = app.model('hard_deletes_counting_1',
        { properties: { id: { type: Number, generated: false, id: true }, name: String, type: String },
          mixins: { Auditz: {softDelete: false} },
          dataSource: 'db'
        }
      );

      Book.create({ id: 1, name: 'book 1', type: 'fiction'});
      Book.create({ id: 2, name: 'book 2', type: 'fiction'});
      Book.create({ id: 3, name: 'book 3', type: 'non-fiction'});

      Book.destroyAll({ type: 'non-fiction' }, function() {
        Book.count({}, function(err, cnt) {
          tt.equal(cnt, 2);
          tt.end();
        });
      });
    });

    t.test('count excludes deleted instances even when a where is supplied', function(tt) {
      var Book = app.model('hard_deletes_counting_1',
        { properties: { id: { type: Number, generated: false, id: true }, name: String, type: String },
          mixins: { Auditz: {softDelete: false} },
          dataSource: 'db'
        }
      );

      Book.create({ id: 1, name: 'book 1', type: 'fiction'});
      Book.create({ id: 2, name: 'book 2', type: 'fiction'});
      Book.create({ id: 3, name: 'book 3', type: 'non-fiction'});

      Book.destroyById(2, function() {
        Book.count({ type: 'fiction'}, function(err, cnt) {
          tt.equal(cnt, 1);
          tt.end();
        });
      });
    });

    t.test('findOrCreate excludes deleted instances by default', function(tt) {
      var Book = app.model('hard_deletes_findOrCreate_1',
        { properties: { id: { type: Number, generated: false, id: true }, name: String, type: String },
          mixins: { Auditz: {softDelete: false} },
          dataSource: 'db'
        }
      );

      Book.create({ id: 1, name: 'book 1', type: 'fiction'});
      Book.create({ id: 2, name: 'book 2', type: 'fiction'});
      Book.create({ id: 3, name: 'book 3', type: 'non-fiction'});

      Book.destroyById(2, function() {
        Book.findOrCreate({where: {name: 'book 2'}}, { id: 4, name: 'book 2', type: 'non-fiction'}, function(err, book) {
          tt.notEqual(book, null);
          tt.notEqual(book.id, 2);
          tt.equal(book.type, 'non-fiction');
          tt.end();
        });
      });
    });

    t.test('findOrCreate excludes deleted instances even when where is not supplied', function(tt) {
      var Book = app.model('hard_deletes_findOrCreate_2',
        { properties: { id: { type: Number, generated: false, id: true }, name: String, type: String },
          mixins: { Auditz: {softDelete: false} },
          dataSource: 'db'
        }
      );

      Book.create({ id: 1, name: 'book 1', type: 'fiction'});
      Book.create({ id: 2, name: 'book 2', type: 'fiction'});
      Book.create({ id: 3, name: 'book 3', type: 'non-fiction'});

      Book.destroyById(2, function() {
        Book.findOrCreate({}, { id: 4, name: 'book 2', type: 'non-fiction'}, function(err, book) {
          tt.notEqual(book, null);
          tt.end();
        });
      });
    });

    t.test('excludes deleted instances by default during queries', function(tt) {
      var Book = app.model('hard_deletes_querying_1',
        { properties: { id: { type: Number, generated: false, id: true }, name: String, type: String },
          mixins: { Auditz: {softDelete: false} },
          dataSource: 'db'
        }
      );

      Book.create({ id: 1, name: 'book 1', type: 'fiction'});
      Book.create({ id: 2, name: 'book 2', type: 'fiction'});
      Book.create({ id: 3, name: 'book 3', type: 'non-fiction'});

      Book.destroyAll({ type: 'non-fiction' }, function() {
        Book.find({}, function(err, books) {
          tt.equal(books.length, 2);
          tt.equal(books[0].id, 1);
          tt.equal(books[1].id, 2);
          tt.end();
        });
      });
    });

    t.test('includes deleted instances by configuration during queries', function(tt) {
      var Book = app.model('hard_deletes_querying_2',
        { properties: { id: { type: Number, generated: false, id: true }, name: String, type: String },
          mixins: { Auditz: {softDelete: false} },
          dataSource: 'db'
        }
      );

      Book.create({ id: 1, name: 'book 1', type: 'fiction'});
      Book.create({ id: 2, name: 'book 2', type: 'fiction'});
      Book.create({ id: 3, name: 'book 3', type: 'non-fiction'});

      Book.destroyAll({type: 'non-fiction'}, function() {
        Book.find({includeDeleted}, function(err, books) {
          tt.equal(books.length, 2);
          tt.end();
        });
      });
    });

    t.test('should add a deletedAt property to all matching', function(tt) {
      var Book = app.model('hard_deletes_destroyAll_1',
        { properties: { name: String, type: String },
          mixins: { Auditz: {softDelete: false} },
          dataSource: 'db'
        }
      );

      Book.create({ name: 'book 1', type: 'fiction'});
      Book.create({ name: 'book 2', type: 'fiction'});
      Book.create({ name: 'book 3', type: 'non-fiction'});

      Book.destroyAll({type: 'fiction'}, function() {
        Book.find(includeDeleted, function(err, books) {
          tt.equal(books.length, 1);
          tt.end();
        });
      });
    });

    t.test('should add a deletedAt property to the appropriate instance', function(tt) {
      var Book = app.model('hard_deletes_destroyById_1',
        { properties: { id: { type: Number, generated: false, id: true }, name: String, type: String },
          mixins: { Auditz: {softDelete: false} },
          dataSource: 'db'
        }
      );

      Book.create({ id: 1, name: 'book 1', type: 'fiction'});
      Book.create({ id: 2, name: 'book 2', type: 'fiction'});
      Book.create({ id: 3, name: 'book 3', type: 'non-fiction'});

      Book.destroyById(1, function() {
        Book.find(includeDeleted, function(err, books) {
          tt.equal(books.length, 2);
          tt.end();
        });
      });

    });

    t.test('should add a deletedAt property to the instance', function(tt) {
      var Book = app.model('hard_deletes_destroy_1',
        { properties: { id: {type: Number, generated: false, id: true}, name: String, type: String },
          mixins: { Auditz: {softDelete: false} },
          dataSource: 'db'
        }
      );

      Book.create({ name: 'book 1', type: 'fiction'}, function(err, book) {
        book.destroy({}, function(err, b) {
          tt.equal(b.count, 1);
          tt.end();
        });
      });

    });

    t.end();
  });

  tap.test('boot options', function(t) {

    t.test('should use createdOn and updatedOn instead', function(tt) {
      var Book = app.model('createdOn_1',
        {
          properties: {id: {type: Number, generated: false, id: true}, name: String, type: String},
          mixins    : {Auditz: { createdAt:'createdOn', updatedAt:'updatedOn', revisions: false }},
          dataSource: 'db'
        }
      );
      Book.destroyAll(function(err) {
        tt.error(err);
        Book.create({name:'book 1', type:'fiction'}, function(err, book) {
          tt.error(err);

          tt.type(book.createdAt, 'undefined');
          tt.type(book.updatedAt, 'undefined');

          tt.type(book.createdOn, Date);
          tt.type(book.updatedOn, Date);

          tt.end();
        });
      });
    });

    t.test('should default required on createdAt and updatedAt ', function(tt) {
      var Book = app.model('required_1',
        {
          properties: {id: {type: Number, generated: false, id: true}, name: String, type: String},
          mixins    : {Auditz: true},
          dataSource: 'db'
        }
      );
      tt.equal(Book.definition.properties.createdAt.required, true);
      tt.equal(Book.definition.properties.updatedAt.required, true);
      tt.end();
    });

    t.test('should have optional createdAt and updatedAt', function(tt) {
      var Book = app.model('required_2',
        {
          properties: {id: {type: Number, generated: false, id: true}, name: String, type: String},
          mixins    : {Auditz: { required: false }},
          dataSource: 'db'
        }
      );
      tt.equal(Book.definition.properties.createdAt.required, false);
      tt.equal(Book.definition.properties.updatedAt.required, false);
      tt.end();
    });

    t.test('should not have createdAt', function(tt) {
      var Book = app.model('no_createdAt',
        {
          properties: {id: {type: Number, generated: false, id: true}, name: String, type: String},
          mixins    : {Auditz: { createdAt: false }},
          dataSource: 'db'
        }
      );
      tt.equal(Book.definition.properties.createdAt, undefined);
      Book.destroyAll(function(err) {
        tt.error(err);
        Book.create({name:'book 1', type:'fiction'}, function(err, book) {
          tt.error(err);

          tt.type(book.createdAt, 'undefined');
          tt.equal(book.createdBy, 0);

          tt.end();
        });
      });
    });

    t.test('should not have createdBy', function(tt) {
      var Book = app.model('no_createdBy',
        {
          properties: {id: {type: Number, generated: false, id: true}, name: String, type: String},
          mixins    : {Auditz: { createdBy: false }},
          dataSource: 'db'
        }
      );
      tt.equal(Book.definition.properties.createdBy, undefined);
      Book.destroyAll(function(err) {
        tt.error(err);
        Book.create({name:'book 1', type:'fiction'}, function(err, book) {
          tt.error(err);

          tt.type(book.createdBy, 'undefined');
          tt.type(book.createdAt, Date);

          tt.end();
        });
      });
    });

    t.test('should not have updatedAt', function(tt) {
      var Book = app.model('no_updatedAt',
        {
          properties: {id: {type: Number, generated: false, id: true}, name: String, type: String},
          mixins    : {Auditz: { updatedAt: false }},
          dataSource: 'db'
        }
      );
      tt.equal(Book.definition.properties.updatedAt, undefined);
      Book.destroyAll(function(err) {
        tt.error(err);
        Book.create({name:'book 1', type:'fiction'}, function(err, book) {
          tt.error(err);

          // ensure we give enough time for the updatedAt value to be different
          setTimeout(function pause() {
            book.updateAttributes({ type:'historical-fiction' }, function(err, b) {
              tt.error(err);
              tt.type(book.updatedAt, 'undefined');
              tt.equal(book.updatedBy, 0);
              // tt.ok(b.updatedAt.getTime() > updatedAt.getTime());
              tt.end();
            });
          }, 1);

        });
      });
    });

    t.test('should not have updatedBy', function(tt) {
      var Book = app.model('no_updatedBy',
        {
          properties: {id: {type: Number, generated: false, id: true}, name: String, type: String},
          mixins    : {Auditz: { updatedBy: false }},
          dataSource: 'db'
        }
      );
      var updatedAt;
      tt.equal(Book.definition.properties.updatedBy, undefined);
      Book.destroyAll(function(err) {
        tt.error(err);
        Book.create({name:'book 1', type:'fiction'}, function(err, book) {
          tt.error(err);

          updatedAt = book.updatedAt;

          // ensure we give enough time for the updatedAt value to be different
          setTimeout(function pause() {
            book.updateAttributes({ type:'historical-fiction' }, function(err, b) {
              tt.error(err);
              tt.ok(b.updatedAt.getTime() > updatedAt.getTime());
              tt.type(book.updatedBy, 'undefined');
              tt.end();
            });
          }, 1);

        });
      });
    });

    t.test('should turn on validation and upsert fails', function(tt) {
      var Book = app.model('validate_1',
        {
          properties: {id: {type: Number, generated: false, id: true}, name: String, type: String},
          mixins    : {Auditz: { validateUpsert: true  }},
          dataSource: 'db'
        }
      );

      Book.destroyAll(function() {
        Book.create({name:'book 1', type:'fiction'}, function(err, book) {
          tt.error(err);
          // this upsert call should fail because we have turned on validation
          Book.updateOrCreate({id:book.id, type: 'historical-fiction'}, function(err) {
            tt.equal(err.name, 'ValidationError');
            tt.equal(err.details.context, 'validate_1');
            tt.ok(err.details.codes.createdAt.indexOf('presence') >= 0);
            tt.end();
          });
        });
      });
    });

    t.test('should fail upsert when validateUpsert is set to true on the model', function(tt) {
      var Book = app.model('validate_1',
        {
          options   : { validateUpsert: true  },
          properties: {id: {type: Number, generated: false, id: true}, name: String, type: String},
          mixins    : {Auditz: {validateUpsert: true}},
          dataSource: 'db'
        }
      );

      Book.destroyAll(function() {
        Book.create({name:'book 1', type:'fiction'}, function(err, book) {
          tt.error(err);
          // this upsert call should fail because we have turned on validation
          Book.updateOrCreate({id:book.id, type: 'historical-fiction'}, function(err) {
            tt.equal(err.name, 'ValidationError');
            tt.equal(err.details.context, 'validate_1');
            tt.ok(err.details.codes.createdAt.indexOf('presence') >= 0);
            tt.end();
          });
        });
      });
    });

    t.end();

  });

tap.test('operation hook options', function(t) {

    t.test('should skip changing updatedAt when option passed', function(tt) {
      Widget.destroyAll(function() {
        Widget.create({name:'book 1', type:'fiction'}, function(err, book1) {
          tt.error(err);

          tt.type(book1.updatedAt, Date);

          var book = {id: book1.id, name:'book 2'};

          Widget.updateOrCreate(book, {skipUpdatedAt: true}, function(err, book2) {
            tt.error(err);

            tt.type(book2.updatedAt, Date);
            tt.equal(book1.updatedAt.getTime(), book2.updatedAt.getTime());
            tt.end();
          });

        });
      });
    });

    t.end();

  });

  tap.end();

});
