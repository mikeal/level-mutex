### level-mutex

`npm install level-mutex`

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