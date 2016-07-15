
require "isDev"

emptyFunction = require "emptyFunction"
PureObject = require "PureObject"
assertType = require "assertType"
immediate = require "immediate"
hasKeys = require "hasKeys"
Tracer = require "tracer"
isType = require "isType"
assert = require "assert"
Type = require "Type"
sync = require "sync"
bind = require "bind"
has = require "has"

PENDING = Symbol "Promise.PENDING"
FULFILLED = Symbol "Promise.FULFILLED"
REJECTED = Symbol "Promise.REJECTED"

type = Type "Promise"

type.defineValues

  _state: PENDING

  _unhandled: yes

  _results: -> [ undefined ]

  _queue: -> []

  _tracers: isDev and -> {}

type.initInstance (result) ->
  @_inherit arguments, 1
  @_tryFulfilling result if result isnt PENDING

type.definePrototype

  state: get: ->
    if @isFulfilled then "fulfilled"
    else if @isRejected then "rejected"
    else "pending"

  isPending: get: ->
    @_state is PENDING

  isFulfilled: get: ->
    @_state is FULFILLED

  isRejected: get: ->
    @_state is REJECTED

type.defineMethods

  trace: ->
    @_tracers.init and @_tracers.init()[1].stack

  inspect: ->

    promise = { @state }

    if @isFulfilled
      promise.value = @_results[0]

    else if @isRejected
      promise.error = @_results[0]

    if @_results.length > 1
      promise.meta = @_results.slice 1

    return promise

  then: (onFulfilled, onRejected) ->

    assertType onFulfilled, Function.Maybe
    assertType onRejected, Function.Maybe

    promise = Promise PENDING
    isDev and promise._tracers.init = Tracer "promise.then()"

    @_then promise, onFulfilled, onRejected
    return promise

  fail: (onRejected) ->

    assertType onRejected, Function.Maybe

    promise = Promise PENDING
    isDev and promise._tracers.init = Tracer "promise.fail()"

    @_then promise, undefined, onRejected
    return promise

  always: (onResolved) ->

    assertType onResolved, Function

    promise = Promise PENDING
    isDev and promise._tracers.init = Tracer "promise.always()"

    @_always (parent) ->

      try value = onResolved()
      catch error
        promise._reject error
        return

      if isType value, Promise
        return value._always ->
          if value.isRejected
            promise._reject value._results[0]
          else
            promise._inherit parent._results, 1
            promise._resolve parent

      # TODO: Support "thenables" returned by `always` callbacks.
      # resolver = value and value.then
      # if isType resolver, Function
      #   promise._defer bind.func resolver, value
      #   return

      promise._inherit parent._results, 1
      promise._resolve parent

    return promise

  notify: (callback) ->

    if not callback
      return this

    assertType callback, Function

    promise = Promise PENDING
    isDev and promise._tracers.init = Tracer "promise.notify()"

    @_always (parent) ->

      promise._inherit parent._results, 1

      if parent.isRejected
        error = parent._results[0]

      else if parent.isFulfilled
        result = parent._results[0]

      try
        callback error, result
        promise._resolve parent
      catch callbackError
        promise._reject callbackError

    return promise

  assert: (reason, predicate) ->

    assertType reason, String
    assertType predicate, Function.Maybe

    promise = Promise PENDING
    isDev and promise._tracers.init = Tracer "promise.assert()"

    predicate ?= emptyFunction.thatReturnsArgument
    @_then promise, (result) ->
      if not predicate result
        throw Error reason
      return result

    return promise

  _inherit: (results, offset) ->

    assertType results, [ Array, Object ]

    { length } = results
    return if offset >= length

    index = offset - 1
    @_results.push results[index] while ++index < length
    return

  _resolve: (parent, onFulfilled, onRejected) ->

    assertType parent, Promise
    assertType onFulfilled, Function.Maybe
    assertType onRejected, Function.Maybe

    assert not parent.isPending, "The parent Promise must be resolved!"

    return if not @isPending

    if parent.isFulfilled
      if onFulfilled
        return @_tryResolving onFulfilled, parent._results
      return @_fulfill parent._results[0]

    if onRejected
      return @_tryResolving onRejected, parent._results
    return @_reject parent._results[0]

  _fulfill: (value) ->

    assert not isType(value, Promise), "Cannot fulfill with a Promise as the result!"

    return if not @isPending

    @_state = FULFILLED
    @_results[0] = value

    {length} = queue = @_queue
    @_queue = null

    return if not length
    immediate this, ->
      index = -1
      while ++index < length
        queue[index].fulfill this
      return

  _reject: (error) ->

    assertType error, Error.Kind

    return if not @isPending

    @_state = REJECTED
    @_results[0] = error

    queue = @_queue
    @_queue = null

    immediate this, ->
      index = -1

      if @_unhandled
        {length} = queue = Promise._rejectFallbacks
        while ++index < length
          queue[index] error, this
        return

      # If 'this._unhandled' is false, we know
      # for sure that the queue is not empty.
      {length} = queue
      while ++index < length
        queue[index].reject this
      return

  _tryFulfilling: (value) ->

    if isType value, Promise
      return value._always =>
        @_inherit value._results, 1
        @_resolve value

    # Support foreign promises.
    resolver = value and value.then
    if isType resolver, Function
      @_defer bind.func resolver, value
      return

    @_fulfill value
    return

  _tryResolving: (resolver, args) ->
    assertType resolver, Function
    assertType args, Array.Maybe
    immediate this, ->
      try value = resolver.apply null, args
      catch error then return @_reject error
      assert value isnt this, "Cannot resolve a Promise with itself!"
      @_tryFulfilling value

  _then: (promise, onFulfilled, onRejected) ->

    assertType promise, Promise
    assertType onFulfilled, Function.Maybe
    assertType onRejected, Function.Maybe

    @_always (parent) ->
      promise._resolve parent, onFulfilled, onRejected

  _always: (onResolved) ->

    assertType onResolved, Function

    @_unhandled = no

    if not @isPending
      return immediate this, ->
        onResolved this

    @_queue.push
      fulfill: onResolved
      reject: onResolved

  _defer: (resolver) ->

    assertType resolver, Function

    if resolver.length
      resolve = bind.method this, "_tryFulfilling"
      if resolver.length > 1
        reject = bind.method this, "_reject"

    immediate this, ->
      try resolver resolve, reject
      catch error then @_reject error

    return this

type.defineStatics

  isFulfilled: (value) ->
    return no if not isType value, Promise
    return value.isFulfilled

  isRejected: (value) ->
    return yes if not isType value, Promise
    return value.isRejected

  isPending: (value) ->
    return no if not isType value, Promise
    return value.isPending

  defer: (resolver) ->

    assertType resolver, Function.Maybe

    promise = Promise PENDING
    isDev and promise._tracers.init = Tracer "Promise.defer()"

    if resolver
      return promise._defer resolver

    return {
      promise
      resolve: bind.method promise, "_tryFulfilling"
      reject: bind.method promise, "_reject"
    }

  reject: (error) ->
    assertType error, Error.Kind
    promise = Promise PENDING
    isDev and promise._tracers.init = Tracer "Promise.reject()"
    promise._reject error
    return promise

  try: (func) ->
    assertType func, Function
    promise = Promise PENDING
    isDev and promise._tracers.init = Tracer "Promise.try()"
    promise._tryResolving func
    return promise

  wrap: (func) ->
    assertType func, Function
    return ->
      promise = Promise PENDING
      isDev and promise._tracers.init = Tracer "Promise.wrap()"
      promise._tryResolving bind.func func, this, arguments
      return promise

  ify: (func) ->
    assertType func, Function
    return ->
      self = this
      args = arguments

      promise = Promise PENDING
      isDev and promise._tracers.init = Tracer "Promise.ify()"

      return promise._defer (resolve, reject) ->

        Array::push.call args, (error, result) ->
          if error then reject error
          else resolve result

        func.apply self, args

  all: (array) ->

    assertType array, Array

    { length } = array

    if length is 0
      return Promise []

    promise = Promise PENDING
    isDev and promise._tracers.init = Tracer "Promise.all()"

    results = new Array length
    remaining = length

    reject = bind.method promise, "_reject"
    fulfill = (result, index) ->
      return if not promise.isPending
      assertType index, Number
      results[index] = result
      remaining -= 1
      if remaining is 0
        promise._fulfill results
      return

    sync.repeat length, (index) ->
      Promise array[index], index
        .then fulfill, reject

    return promise

  map: (iterable, iterator) ->

    assertType iterator, Function

    promise = Promise PENDING
    isDev and promise._tracers.init = Tracer "Promise.map()"

    if Array.isArray iterable
      results = new Array iterable.length

    else if PureObject.test iterable
      results = Object.create null

    else
      results = {}

    if not hasKeys iterable
      promise._fulfill results
      return promise

    reject = bind.method promise, "_reject"
    fulfill = (result, key) ->
      return if has results, key
      results[key] = result
      remaining -= 1
      if remaining is 0
        promise._fulfill results
      return

    remaining = 0
    sync.each iterable, (value, key) ->
      remaining += 1
      item = Promise.try -> iterator.call null, value, key
      item._results.push key
      item.then fulfill, reject
      return

    return promise

  chain: (iterable, iterator) ->
    assertType iterator, Function
    return sync.reduce iterable, Promise(), (chain, value, key) ->
      chain.then -> iterator.call null, value, key

  onUnhandledRejection: (fallback) ->
    @_rejectFallbacks.push fallback
    return

  _onUnhandledRejection:
    get: -> emptyFunction
    set: ->
      error = Error "'Promise._onUnhandledRejection' is deprecated!"
      console.log "\n" + error.stack

  _rejectFallbacks: []

module.exports = Promise = type.build()
