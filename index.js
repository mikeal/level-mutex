var util = require('util')
  , events = require('events')
  , peek = require('level-peek')
  ;

function parallel (arr, cb) {
  var results = []
    , complete = 0
    ;
  for (var i=0;i<arr.length;i++) {
    ;(function (i) {
      arr[i][0](function () {
        results[i] = Array.prototype.slice.call(arguments)
        complete += 1
        if (complete === arr.length) {
          for (var ii=0;ii<arr.length;ii++) {
            arr[ii][1].apply(arr[ii][1], results[ii])
          }
          cb()
        }
      })
    })(i)
  }
  if (arr.length === 0) cb()
}

function extend(a, b) {
  var keys = Object.keys(b)
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i]
    a[key] = b[key]
  }
}

function Mutex (lev) {
  this.lev = lev
  this.writing = false
  this.reading = false
  this.writes = []
  this.reads = []
}
util.inherits(Mutex, events.EventEmitter)
Mutex.prototype.put = function (key, value, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = undefined
  }
  var write = {type:'put', key:key, value:value}
  if (opts) extend(write, opts)
  this.writes.push([write, cb])
  this.kick()
}
Mutex.prototype.get = function (key, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  var self = this
  this.reads.push([function (_cb) { self.lev.get(key, opts, _cb) }, cb])
  this.kick()
}
Mutex.prototype.del = function (key, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = undefined
  }
  if (!cb) throw new Error('no cb')
  var del = {type:'del', key:key}
  if (opts) extend(del, opts)
  this.writes.push([del, cb])
  this.kick()
}
Mutex.prototype.peekLast = function (opts, cb) {
  var self = this
  this.reads.push([function (_cb) { peek.last(self.lev, opts, _cb) }, cb])
  this.kick()
}
Mutex.prototype.peekFirst = function (opts, cb) {
  var self = this
  this.reads.push([function (_cb) { peek.first(self.lev, opts, _cb) }, cb])
  this.kick()
}

Mutex.prototype.kick = function () {
  var self = this
  if (this.writing || this.reading) return
  if (!this.writes.length && !this.reads.length) return
  if (!this._nt) {
    this._nt = true
    setImmediate(function () {
      self._nt = false
      self._read()
    })
  }
}
Mutex.prototype._read = function () {
  var self = this
    , reads = this.reads
    ;
  this.reading = true
  this.reads = []
  this.emit('reads', reads)
  parallel(reads, function () {
    self.reading = false
    self._write()
  })
}
Mutex.prototype._write = function () {
  if (!this.writes.length) return this.kick()
  var self = this
    , writes = this.writes.map(function (x) {return x[0]})
    , callbacks = this.writes.map(function (x) {return x[1]})
    ;
  this.writing = true
  this.writes = []

  this.emit('writes', writes)
  this.lev.batch(writes, function (e) {
    self.emit('flushed')
    callbacks.forEach(function (cb) {
      cb(e)
    })
    self.writing = false

    self.kick()
  })
}
Mutex.prototype.afterWrite = function (cb) {
  var self = this
  // must wrap in setImmediate in case this is called from a write callback
  setImmediate(function () {
    if (self.writing || self.writes.length) self.once('flushed', cb)
    else cb()
  })
}

module.exports = function (lev) {return new Mutex(lev)}