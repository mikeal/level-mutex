### level-mutex

`npm install level-mutex`

#### What is this?

`level-mutex` is an abstract "lock" around a `levelup` store. What it does is cycle between reads and writes, allowing all writes to return in order while queuing all reads, then running all reads and returning in order, then writing all the pending writes again. `level-mutex` uses node.js' single threaded nature to your advantage so that you can maintain a higher order locking structure to insure various types of read-on-write consistency semantics.

This is currently used in [couchup](http://github.com/mikeal/couchup) to ensure users cannot update a document without providing the latest revision.

While you do scope `level-mutex` to a single levelup store there is nothing stopping you from having many mutexes around the same store provided you're using each to manage a separate higher order consistency guarantee. For instance, `couchup` uses a mutex *per database* and an indefinite number of databases might exist in a single levelup store.

```javascript
var levelup = require('levelup')
  , mutex = require('level-mutex')
  ;

var store = levelup('./testdb')
  , mymutex = mutex(store)
  , pending = []
  ;

function write (key, revision, value, cb) {
  mymutex.get('key', function (e, val) {
    // verify that the revision being written is the current one in the database
    if (e || value.revision !=== revision) return cb(new Error('rev is out of date'))
    // if this key is being written then nobody has read it yet which means
    // someone writing it can't be writing to the new revision
    if (pending.indexOf(key) !== -1) return cb(new Error('rev is out of date'))
    pending.push(key)
    // bump the rev
    value.revision = value.revision + 1
    mymutex.put(key, value, function (e) {
      if (e) return cb(e)
      cb(null, {rev:value.revision})
    })
  })
}

// flush all pending keys when writes have been flushed.
mymutex.on('flushed', function () {
  pending = []
})
```

#### methods

* get
* put
* del
* peekLast
* peekFirst
* afterWrite


#### events

* reads
* writes
* flushed