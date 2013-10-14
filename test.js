var lev = require('levelup')
  , mutex = require('./')
  , cleanup = require('cleanup')
  , rimraf = require('rimraf')
  , assert = require('assert')
  , ok = require('okdone')
  , async = require('async')
  ;

var d = cleanup(function (error) {
  rimraf.sync('./testdb')
  if (!error) ok.done()
  if (error) process.exit(1)
  process.exit()
})

var m = mutex(lev('./testdb'))

testOrder(function() {
  testOpts(function() {
    d.cleanup()
  })
})

function testOrder(done) {
  var documents = ['test1', 'test2', 'test3', 'test4', 'test5', 'test6']

  async.map(documents, m.get.bind(m), function (e) {
    if (!e) throw new Error('Documents should not exist yet')
    ok('does not exist')
  })

  var writing = false

  async.map(documents, function (key, cb) {writing = true; m.put(key, 1, cb)}, function (e, results) {
    if (e) throw e
    ok('write')
  })

  setImmediate(function () {
    assert.ok(writing)
    async.map(documents, m.get.bind(m), function (e, results) {
      if (e) throw e
      assert.equal(results.length, results.reduce(function (x,y) {return x+parseInt(y)}, 0))
      ok('exists')

      m.peekLast({end:'test3'}, function (err, key, value) {
        if (err) throw err
        assert.equal(key, 'test3')
        assert.equal(value, 1)
        ok('peekLast')
        m.peekFirst({start:'test4'}, function (err, key, value) {
          if (err) throw err
          assert.equal(key, 'test4')
          assert.equal(value, 1)
          ok('peekFirst')
          done()
        })
      })
    })
  })
}

function testOpts(cb) {
  var doc = {"tasty": true}
  m.put('tacos', doc, {valueEncoding: 'json'}, function(err) {
    if (err) throw err
    m.get('tacos', {valueEncoding: 'json'}, function(err, obj) {
      if (err) throw err
      assert.equal(JSON.stringify(obj), JSON.stringify(doc))
      m.del('tacos', function(err) {
        if (err) throw err
        ok('options work')
        cb()
      })
    })
  })
}

ok.expect(6)
