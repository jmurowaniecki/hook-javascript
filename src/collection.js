module.exports = class Collection {

  /**
   * @module Hook
   * @class Hook.Collection
   *
   * @param {Hook.Client} client
   * @param {String} name
   * @constructor
   */
  constructor(client, name) {
    this.client = client;

    this.name = this._validateName(name);
    this.reset();

    this.segments = 'collection/' + this.name;
  }

  /**
   * Create a new resource
   * @method create
   * @param {Object} data
   * @return {Hook.Collection} this
   *
   * @example Creating an entry
   *
   *     client.collection('posts').create({
   *       title: "Post name",
   *       summary: "My awesome new post",
   *       stars: 5
   *     });
   *
   * @example Listening to complete event
   *
   *     // Verbose way
   *     var c = client.collection('posts');
   *     var promise = c.create({ title: "Post name", summary: "Something", stars: 5 });
   *     promise.then(function(data) {
   *         console.log(data);
   *     });
   *
   *     // Short way
   *     client.collection('posts').create({ title: "Post name", summary: "Something", stars: 5 }).then(function(data) {
   *         console.log(data);
   *     });
   *
   */
  create(data) {
    return this.client.post(this.segments, data);
  }

  /**
   * Fields that should be retrieved from the database
   * @method select
   * @return {Hook.Collection} this
   */
  select() {
    this.options.select = arguments;
    return this;
  }

  /**
   * Get collection data, based on `where` params.
   * @method get
   * @return {Hook.Collection} this
   */
  get() {
    return this.client.get(this.segments, this.buildQuery());
  }

  /**
   * Add `where` param
   * @method where
   * @param {Object | String} where params or field name
   * @param {String} operation '<', '<=', '>', '>=', '!=', 'in', 'between', 'not_in', 'not_between', 'like', 'not_null'
   * @param {String} value value
   * @return {Hook.Collection} this
   *
   * @example Multiple 'where' calls
   *
   *     var c = client.collection('posts');
   *     c.where('author','Vicente'); // equal operator may be omitted
   *     c.where('stars','>',10);     // support '<' and '>' operators
   *     c.then(function(result) {
   *       console.log(result);
   *     });
   *
   * @example One 'where' call
   *
   *     client.collection('posts').where({
   *       author: 'Vicente',
   *       stars: ['>', 10]
   *     }).then(function(result) {
   *       console.log(result);
   *     })
   *
   * @example Filtering 'in' value list.
   *
   *     client.collection('posts').where('author_id', 'in', [500, 501]).then(function(result) {
   *       console.log(result);
   *     })
   *
   * @example Partial String matching
   *
   *     client.collection('posts').where('author', 'like', '%Silva%').then(function(result) {
   *       console.log(result);
   *     })
   *
   */
  where(objects, _operation, _value, _boolean) {
    var field,
        operation = (typeof(_value)==="undefined") ? '=' : _operation,
        value = (typeof(_value)==="undefined") ? _operation : _value,
        boolean = (typeof(_boolean)==="undefined") ? 'and' : _boolean;

    if (typeof(objects)==="object") {
      for (field in objects) {
        if (objects.hasOwnProperty(field)) {
          operation = '=';
          if (objects[field] instanceof Array) {
            operation = objects[field][0];
            value = objects[field][1];
          } else {
            value = objects[field];
          }
          this.addWhere(field, operation, value, boolean);
        }
      }
    } else {
      this.addWhere(objects, operation, value, boolean);
    }

    return this;
  }

  /**
   * Add OR query param
   * @method orWhere
   * @param {Object | String} where params or field name
   * @param {String} operation '<', '<=', '>', '>=', '!=', 'in', 'between', 'not_in', 'not_between', 'like', 'not_null'
   * @param {String} value value
   * @return {Hook.Collection} this
   */
  orWhere(objects, _operation, _value) {
    return this.where(objects, _operation, _value, "or");
  }

  /**
   * Find first item by _id
   * @method find
   * @param {Number} _id
   * @param {Function} callback [optional]
   * @return {Promise}
   *
   * @example Finding first item by _id, with 'success' callback as param.
   *
   *     client.collection('posts').find(50, function(data) {
   *       console.log("Row:", data);
   *     });
   *
   * @example Catching 'not found' error.
   *
   *     client.collection('posts').find(128371923).then(function(data) {
   *       console.log("Row:", data); // will never execute this
   *     }).otherwise(function(e) {
   *       console.log("Not found.");
   *     });
   *
   */
  find(_id) {
    var promise = this.client.get(this.segments + '/' + _id, this.buildQuery());
    if (arguments.length > 1) {
      return promise.then.apply(promise, Array.prototype.slice.call(arguments,1));
    }
    return promise;
  }

  /**
   * Set the relationships that should be eager loaded.
   * @method join
   * @param {String} ...
   * @return {Hook.Collection}
   *
   * @example Simple relationship
   *
   *     client.collection('books').join('author').each(function(book) {
   *       console.log("Author: ", book.author.name);
   *     });
   *
   * @example Multiple relationships
   *
   *     client.collection('books').join('author', 'publisher').each(function(book) {
   *       console.log("Author: ", book.author.name);
   *       console.log("Publisher: ", book.publisher.name);
   *     });
   *
   * @example Nested relationships
   *
   *     client.collection('books').join('author.contacts').each(function(book) {
   *       console.log("Author: ", book.author.name);
   *       console.log("Contacts: ", book.author.contacts);
   *     });
   *
   */
  join() {
    this.options['with'] = arguments;
    return this;
  }


  /**
   * The 'distinct' can be used to return only distinct (different) values.
   * @method distinct
   * @param {String} field
   * @param {String} ... more fields
   * @return {Hook.Collection} this
   */
  distinct() {
    this.options.distinct = true;
    return this;
  }

  /**
   * Group results by field
   * @method group
   * @param {String} field
   * @param {String} ... more fields
   * @return {Hook.Collection} this
   */
  group() {
    this._group = arguments;
    return this;
  }

  /**
   * Count the number of items on this collection
   * @method count
   * @param {Function} callback [optional]
   * @return {Promise}
   *
   * @example Count the elements of the current query
   *
   *     client.collection('posts').where('author','Vicente').count(function(total) {
   *       console.log("Total:", total);
   *     });
   */
  count(field) {
    field = (typeof(field)==="undefined") ? '*' : field;
    this.options.aggregation = {method: 'count', field: field};
    var promise = this.get();
    if (arguments.length > 0) {
      promise.then.apply(promise, arguments);
    }
    return promise;
  }

  /**
   * Aggregate field with 'max' values
   * @method max
   * @param {String} field
   * @param {Function} callback [optional]
   * @return {Promise}
   *
   * @example Get the max value from highscore collection
   *
   *     client.collection('highscore').max('score', function(data) {
   *       console.log("max: ", data);
   *     });
   */
  max(field) {
    this.options.aggregation = {method: 'max', field: field};
    var promise = this.get();
    if (arguments.length > 1) {
      promise.then.apply(promise, Array.prototype.slice.call(arguments,1));
    }
    return promise;
  }

  /**
   * Aggregate field with 'min' values
   * @method min
   * @param {String} field
   * @param {Function} callback [optional]
   * @return {Promise}
   *
   * @example Get the min value from highscore collection
   *
   *     client.collection('highscore').min('score', function(data) {
   *       console.log("min: ", data);
   *     });
   */
  min(field) {
    this.options.aggregation = {method: 'min', field: field};
    var promise = this.get();
    if (arguments.length > 1) {
      promise.then.apply(promise, Array.prototype.slice.call(arguments,1));
    }
    return promise;
  }

  /**
   * Aggregate field with 'avg' values
   * @method avg
   * @param {String} field
   * @param {Function} callback [optional]
   * @return {Promise}
   *
   * @example Get the average value from highscore collection
   *
   *     client.collection('highscore').avg('score', function(data) {
   *       console.log("avg: ", data);
   *     });
   */
  avg(field) {
    this.options.aggregation = {method: 'avg', field: field};
    var promise = this.get();
    if (arguments.length > 1) {
      promise.then.apply(promise, Array.prototype.slice.call(arguments,1));
    }
    return promise;
  }

  /**
   * Aggregate field with 'sum' values
   * @method sum
   * @param {String} field
   * @param {Function} callback [optional]
   * @return {Promise}
   *
   * @example Get the sum value from highscore collection
   *
   *     client.collection('highscore').sum('score', function(data) {
   *       console.log("sum: ", data);
   *     });
   */
  sum(field) {
    this.options.aggregation = {method: 'sum', field: field};
    var promise = this.get();
    if (arguments.length > 1) {
      promise.then.apply(promise, Array.prototype.slice.call(arguments,1));
    }
    return promise;
  }

  /**
   * Query only the first result
   * @method first
   * @param {Function} callback [optional]
   * @return {Promise}
   *
   * @example Return just the first element for current query
   *
   *     client.collection('users').sort('created_at', -1).first(function(data) {
   *       console.log("Last created user:", data);
   *     });
   */
  first() {
    this.options.first = 1;
    var promise = this.get();
    promise.then.apply(promise, arguments);
    return promise;
  }

  /**
   * First or create
   *
   * @method firstOrCreate
   * @param {Object} data
   * @param {Function} callback
   * @return {Promise}
   *
   * example Return the first match for 'data' param, or create it.
   *
   *     client.collection('uniques').firstOrCreate({type: "something"}).then(function(data) {
   *       console.log("Unique row: ", data);
   *     });
   */
  firstOrCreate(data) {
    this.options.first = 1;
    this.options.data = data;
    return this.client.post(this.segments, this.buildQuery());
  }

  /**
   * Alias for get & then
   * @method then
   * @return {Promise}
   */
  each(cb) {
    var promise = this.then(function(data) {
      for (let i=0; i<data.length; i++) {
        cb(data[i]);
      }
    });
    return promise;
  }

  /**
   * Alias for get & then
   * @method then
   * @return {Promise}
   */
  then() {
    var promise = this.get();
    promise.then.apply(promise, arguments);
    return promise;
  }

  /**
   * Alias for then & console.log.bind(console)
   * @method debug
   * @return {Promise}
   */
  debug(func) {
    func = (typeof(func) == "undefined") ? "log" : func;
    return this.then(console[func].bind(console));
  }

  /**
   * Clear collection filtering state
   * @method reset
   * @return {Hook.Collection} this
   */
  reset() {
    this.options = {};
    this.wheres = [];
    this.ordering = [];
    this._group = [];
    this._limit = null;
    this._offset = null;
    this._remember = null;
    return this;
  }

  /**
   * @method sort
   * @param {String} field
   * @param {Number|String} direction
   * @return {Hook.Collection} this
   *
   * @example Return just the first element for current query
   *
   *     // Ommit the second argument for ascending order:
   *     client.collection('users').sort('created_at').then(function(data){ });
   *
   *     // Use 1 or 'asc' to specify ascending order:
   *     client.collection('users').sort('created_at', 1).then(function(data){  });
   *     client.collection('users').sort('created_at', 'asc').then(function(data){  });
   *
   *     // Use -1 or 'desc' for descending order:
   *     client.collection('users').sort('created_at', -1).then(function(data) {  });
   *     client.collection('users').sort('created_at', 'desc').then(function(data) {  });
   */
  sort(field, direction) {
    if (!direction) {
      direction = "asc";
    } else if (typeof(direction)==="number") {
      direction = (parseInt(direction, 10) === -1) ? 'desc' : 'asc';
    }
    this.ordering.push([field, direction]);
    return this;
  }

  /**
   * @method limit
   * @param {Number} int
   * @return {Hook.Collection} this
   *
   * @example Limit the number of rows to retrieve
   *
   *     client.collection('posts').sort('updated_at', -1).limit(5).then(function(data) {
   *       console.log("Last 5 rows updated: ", data);
   *     });
   *
   * @example Limit and offset
   *
   *     client.collection('posts').sort('updated_at', -1).limit(5).offset(5).then(function(data) {
   *       console.log("last 5 rows updated, after 5 lastest: ", data);
   *     });
   */
  limit(int) {
    this._limit = int;
    return this;
  }

  /**
   * @method offset
   * @see limit
   *
   * @param {Number} int
   * @return {Hook.Collection} this
   */
  offset(int) {
    this._offset = int;
    return this;
  }

  /**
   * Indicate that the query results should be cached.
   *
   * @method remember
   * @param {Number} minutes
   * @return {Hook.Collection} this
   *
   * @example Caching a query
   *
   *     client.collection('posts').sort('updated_at', -1).limit(5).remember(10).then(function(data) {
   *       // ...
   *     });
   *
   */
  remember(minutes) {
    this._remember = minutes;
    return this;
  }

  /**
   * Get channel for this collection.
   * @method channel
   * @param {Object} options (optional)
   * @return {Hook.Channel}
   *
   * @example Streaming collection data
   *
   *     client.collection('messages').where('type', 'new-game').channel().subscribe(function(event, data) {
   *       console.log("Received new-game message: ", data);
   *     });
   *
   *     client.collection('messages').create({type: 'sad', text: "i'm sad because streaming won't catch me"});
   *     client.collection('messages').create({type: 'new-game', text: "yey, streaming will catch me!"});
   *
   */
  channel(options) {
    throw new Error("Not implemented.");
    // return new Hook.Channel(this.client, this, options);
  }

  /**
   * @method paginate
   * @return {Hook.Pagination}
   *
   * @param {Mixed} perpage_or_callback
   * @param {Function} onComplete
   * @param {Function} onError (optional)
   */
  paginate(perPage, onComplete, onError) {
    var pagination = new Hook.Pagination(this);

    if (!onComplete) {
      onComplete = perPage;
      perPage = Hook.defaults.perPage;
    }

    this.options.paginate = perPage;
    this.then(function(data) {
      pagination._fetchComplete(data);
      if (onComplete) { onComplete(pagination); }
    }, onError);

    return pagination;
  }

  /**
   * Drop entire collection. This operation is irreversible.
   * @return {Promise}
   */
  drop() {
    return this.client.remove(this.segments);
  }

  /**
   * Remove a single row by id
   * @method remove
   * @param {String} id [optional]
   * @return {Promise}
   *
   * @example Deleting a row by id
   *
   *     client.collection('posts').remove(1).then(function(data) {
   *       console.log("Success:", data.success);
   *     });
   *
   * @example Deleting multiple rows
   *
   *     client.collection('ranking').where('score', 0).remove().then(function(data) {
   *       console.log("Success:", data.success);
   *     });
   */
  remove(_id) {
    var path = this.segments;
    if (typeof(_id)!=="undefined") {
      path += '/' + _id;
    }
    return this.client.remove(path, this.buildQuery());
  }

  /**
   * Update a single collection entry
   * @method update
   * @param {Number | String} _id
   * @param {Object} data
   *
   * @example Updating a single row
   *
   *     client.collection('posts').update(1, { title: "Changing post title" }).then(function(data) {
   *       console.log("Success:", data.success);
   *     });
   */
  update(_id, data) {
    return this.client.post(this.segments + '/' + _id, data);
  }

  /**
   * Increment a value from 'field' from all rows matching current filter.
   * @method increment
   * @param {String} field
   * @param {Number} value
   * @return {Promise}
   *
   * @example Increment user score
   *
   *     client.collection('users').where('_id', user_id).increment('score', 10).then(function(numRows) {
   *       console.log(numRows, " users has been updated");
   *     });
   */
  increment(field, value) {
    this.options.operation = { method: 'increment', field: field, value: value };
    var promise = this.client.put(this.segments, this.buildQuery());
    if (arguments.length > 0) {
      promise.then.apply(promise, arguments);
    }
    return promise;
  }

  /**
   * Decrement a value from 'field' from all rows matching current filter.
   * @method decrement
   * @param {String} field
   * @param {Number} value
   * @return {Promise}
   *
   * @example Decrement user score
   *
   *     client.collection('users').where('_id', user_id).decrement('score', 10).then(function(numRows) {
   *       console.log(numRows, " users has been updated");
   *     });
   */
  decrement(field, value) {
    this.options.operation = { method: 'decrement', field: field, value: value };
    var promise = this.client.put(this.segments, this.buildQuery());
    if (arguments.length > 0) {
      promise.then.apply(promise, arguments);
    }
    return promise;
  }

  /**
   * Update all collection's data based on `where` params.
   * @method updateAll
   * @param {Object} data key-value data to update from matched rows [optional]
   * @return {Promise}
   *
   * @example Updating all rows of the collection
   *
   *     client.collection('users').updateAll({category: 'everybody'}).then(function(numRows) {
   *       console.log(numRows, " users has been updated");
   *     });
   *
   * @example Updating collection filters
   *
   *     client.collection('users').where('age','<',18).updateAll({category: 'baby'}).then(function(numRows) {
   *       console.log(numRows, " users has been updated");
   *     });
   */
  updateAll(data) {
    this.options.data = data;
    return this.client.put(this.segments, this.buildQuery());
  }

  addWhere(field, operation, value, boolean) {
    this.wheres.push([field, operation.toLowerCase(), value, boolean]);
    return this;
  }

  _validateName(name) {
    var regexp = /^[a-z_\/0-9]+$/;

    if (!regexp.test(name)) {
      throw new Error("Invalid name: " + name);
    }

    return name;
  }

  buildQuery() {
    var query = {};

    // apply limit / offset and remember
    if (this._limit !== null) { query.limit = this._limit; }
    if (this._offset !== null) { query.offset = this._offset; }
    if (this._remember !== null) { query.remember = this._remember; }

    // apply wheres
    if (this.wheres.length > 0) {
      query.q = this.wheres;
    }

    // apply ordering
    if (this.ordering.length > 0) {
      query.s = this.ordering;
    }

    // apply group
    if (this._group.length > 0) {
      query.g = this._group;
    }

    var f, shortnames = {
      paginate: 'p',        // pagination (perPage)
      first: 'f',           // first / firstOrCreate
      aggregation: 'aggr',  // min / max / count / avg / sum
      operation: 'op',      // increment / decrement
      data: 'data',         // updateAll / firstOrCreate
      'with': 'with',         // join / relationships
      select: 'select',     // fields to return
      distinct: 'distinct'  // use distinct operation
    };

    for (f in shortnames) {
      if (this.options[f]) {
        query[shortnames[f]] = this.options[f];
      }
    }

    // clear wheres/ordering for future calls
    this.reset();

    return query;
  }

}
