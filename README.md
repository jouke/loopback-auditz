<!-- TITLE/ -->

<h1>loopback-auditz</h1>

<!-- /TITLE -->


<!-- BADGES/ -->

<span class="badge-travisci"><a href="http://travis-ci.org/jouke/loopback-auditz" title="Check this project's build status on TravisCI"><img src="https://img.shields.io/travis/jouke/loopback-auditz/master.svg" alt="Travis CI Build Status" /></a></span>
<span class="badge-npmversion"><a href="https://npmjs.org/package/loopback-auditz" title="View this project on NPM"><img src="https://img.shields.io/npm/v/loopback-auditz.svg" alt="NPM version" /></a></span>
<span class="badge-npmdownloads"><a href="https://npmjs.org/package/loopback-auditz" title="View this project on NPM"><img src="https://img.shields.io/npm/dm/loopback-auditz.svg" alt="NPM downloads" /></a></span>
<span class="badge-coveralls"><a href="https://coveralls.io/r/jouke/loopback-auditz" title="View this project's coverage on Coveralls"><img src="https://img.shields.io/coveralls/jouke/loopback-auditz.svg" alt="Coveralls Coverage Status" /></a></span>
<span class="badge-daviddm"><a href="https://david-dm.org/jouke/loopback-auditz" title="View the status of this project's dependencies on DavidDM"><img src="https://img.shields.io/david/jouke/loopback-auditz.svg" alt="Dependency Status" /></a></span>
<span class="badge-daviddmdev"><a href="https://david-dm.org/jouke/loopback-auditz#info=devDependencies" title="View the status of this project's development dependencies on DavidDM"><img src="https://img.shields.io/david/dev/jouke/loopback-auditz.svg" alt="Dev Dependency Status" /></a></span>

<!-- /BADGES -->


Description
===========

This module is designed for the [Strongloop Loopback](https://github.com/strongloop/loopback) framework. It provides extensive support for Audit Trails in your LoopBack based application.

It consists of a group of functionalities:
* Soft Deletes (based upon the work of [loopback-softdelete-mixin](https://github.com/gausie/loopback-softdelete-mixin)).
* Timestamps of updates/creates (based upon the work of [loopback-ds-timestamp-mixin](https://github.com/clarkbw/loopback-ds-timestamp-mixin)). 
* Registration of the user that created/updated/deleted (thanks to the work of [loopback-component-remote-ctx](https://github.com/snowyu/loopback-component-remote-ctx.js)).
* History logging in a separate table (a port of [Sofa/Revisionable](https://github.com/jarektkaczyk/revisionable)). 

Each of these main functionalities can be turned off individually.

Install
=======

```bash
  npm install --save loopback-component-remote-ctx loopback-auditz
```

Server Config
=============

Add the `mixins` property to your `server/model-config.json`:

```json
{
  "_meta": {
    "sources": [
      "loopback/common/models",
      "loopback/server/models",
      "../common/models",
      "./models"
    ],
    "mixins": [
      "loopback/common/mixins",
      "../node_modules/loopback-auditz",
      "../common/mixins"
    ]
  }
}
```

Make sure you enable authentication by putting the following in a boot script (ie `server/boot/authentication.js`):

```javascript
'use strict';
module.exports = function enableAuthentication(server) {
  // enable authentication
  server.enableAuth();
};
```

Enable the `loopback-component-remote-ctx` by adding the following in your `server/component-config.json`:

```json
  "loopback-component-remote-ctx": {
    "enabled": true,
    "argName": "remoteCtx",
    "blackList": ["User"]
  }
```

And finally use the loopback token middleware by adding the following line to your `server/server.js`:

```javascript
app.use(loopback.token());
```

Configure
=========

To use with your Models add the `mixins` attribute to the definition object of your model config.

```json
  {
    "name": "Widget",
    "properties": {
      "name": {
        "type": "string",
      },
    },
    "mixins": {
      "Auditz" : true,
    },
  },
```

There are a number of configurable options to the mixin:

```json
  "mixins": {
    "Auditz": {
      "createdAt": "created_at",
      "updatedAt": "updated_at",
      "deletedAt": "deleted_at",
      "createdBy": "created_by",
      "updatedBy": "updated_by",
      "deletedBy": "deleted_by",
      "softDelete": true,
      "unknownUser": 0,
      "remoteCtx": "remoteCtx",
      "scrub": true,
      "required": false,
      "validateUpsert": true,
      "silenceWarnings": false,
      "revisions": {
        "name": "other_revisions_table",
        "idType": "Number",
        "dataSource": "db",
        "autoUpdate": false
      }
     },
  },
```

### createdAt
This allows you to define an alternative name for the createdAt field. When set to `false`, this property will not be defined nor used.

### updatedAt
This allows you to define an alternative name for the updatedAt field. When set to `false`, this property will not be defined nor used.

### deletedAt
This allows you to define an alternative name for the deletedAt field. If you don't want the soft delete functionality, specify `'softDelete': false` in the options.

### createdBy
This allows you to define an alternative name for the createdBy field. When set to `false`, this property will not be defined nor used.

### updatedBy
This allows you to define an alternative name for the updatedBy field. When set to `false`, this property will not be defined nor used.

### deletedBy
This allows you to define an alternative name for the deletedBy field.If you don't want the soft delete functionality, specify `'softDelete': false` in the options.

### softDelete
By default, soft delete functionality is turned on and uses the deletedAt and deletedBy configuration options. If you set softDelete to false, it completely ignores
deletedAt, deletedBy and scrub, and all deletes will become hard deletes.

### unknownUser
This allows you to define which userId should be filled out when no current user can be determined

### remoteCtx
The value you provided in `component-config.json` for `argName` of `loopback-component-remote-ctx`

### scrub
If true, this sets all but the "id" fields to null. If an array, it will only scrub properties with those names. However, if you specified `softDelete: false` this option
will be ignored.

### required
This defines the requiredness of the createdAt and updatedAt fields. The `deletedAt` field is never required

### validateUpsert
This defines whether or not the validateUpsert property is set for the model

### silenceWarnings
This defines if the warnings should be suppressed or not

## revisions
If set to false, this disables keeping track of changes in a revisions model. If it's true or an object, keeping track of 
changes in a revisions model is enabled, and the following configuration options are availabe if it's an object:

### name
The name for the revisions model in which to keep changes to the model.

### idType
The data type to assume for id fields. The default is 'Number', which is fine for most databases, but (for example) MongoDB uses strings, so in that case provide "String" as the value for idType.

### dataSource
The dataSource to connect the revisions model to. This dataSource needs to be defined in `datasources.json` first.

### autoUpdate
If set to false, it will assume the model exists in the dataSource already, and we don't need to create or alter the 
table. If set to true, it will run autoupdate on the dataSource for the given revisions model name to make sure the table 
exists with the right columns.

Usage with MongoDB
==================

In case you use MongoDB with this module, and also use the 'revisions' table option, you need to configure the idType as a 'String'. Otherwise this module will attempt to store the non-numeric id in the row_id property of the revisions model, which is a Number by default.

Operation Options
=================

Skipping updatedAt updating
---------------------------

By passing in additional options to an update or save operation you can control when this mixin updates the `updatedAt` field.  
The passing true to the option `skipUpdatedAt` will skip updating the `updatedAt` field.

In this example we assume a book object with the id of 2 already exists. Normally running this operation would change the `updatedAt` field to a new value.

```js
Book.updateOrCreate({name: 'New name', id: 2}, {skipUpdatedAt: true}, function(err, book) {
  // book.updatedAt will not have changed
});
```

Retrieving soft deleted entities
--------------------------------

Unless you specified softDelete to be turned off, you can run queries that include deleted items in the response, by adding `{ deleted: true }` to the query object (at the same level as `where`, `include` etc).


<!-- CONTRIBUTE/ -->

<h2>Contribute</h2>

<a href="https://github.com/jouke/loopback-auditz/blob/master/CONTRIBUTING.md#files">Discover how you can contribute by heading on over to the <code>CONTRIBUTING.md</code> file.</a>

<!-- /CONTRIBUTE -->


<!-- LICENSE/ -->

<h2>License</h2>

Unless stated otherwise all works are:

<ul><li>Copyright &copy; <a href="jouke@studio-mv.nl">Jouke Visser</a></li></ul>

and licensed under:

<ul><li><a href="http://spdx.org/licenses/ISC.html">ISC License</a></li></ul>

<!-- /LICENSE -->
