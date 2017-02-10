
emptyFunction = require "emptyFunction"
PureObject = require "PureObject"
assertType = require "assertType"
immediate = require "immediate"
hasKeys = require "hasKeys"
Tracer = require "tracer"
isType = require "isType"
Type = require "Type"
sync = require "sync"
bind = require "bind"
has = require "has"

PENDING = Symbol "Promise.PENDING"
FULFILLED = Symbol "Promise.FULFILLED"
REJECTED = Symbol "Promise.REJECTED"

type = Type "Promise"

type.trace()

type.defineGetters

  state: ->
    if @isFulfilled then "fulfilled"
    else if @isRejected then "rejected"
    else "pending"

  isPending: ->
    @_state is PENDING

  isFulfilled: ->
    @_state is FULFILLED

  isRejected: ->
    @_state is REJECTED

type.defineMethods

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
    @_then promise, onFulfilled, onRejected
    return promise

  catch: (onRejected) ->
    return @fail onRejected

  fail: (onRejected) ->
    assertType onRejected, Function.Maybe
    promise = Promise PENDING
    @_then promise, undefined, onRejected
    return promise

  finally: (onResolved) ->
    return @always onResolved

  always: (onResolved) ->

    assertType onResolved, Function

    promise = Promise PENDING
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

  done: (onFulfilled, onRejected) ->
    if arguments.length
      @then onFulfilled, onRejected
    return

  notify: (callback) ->

    if not callback
      return this

    assertType callback, Function

    promise = Promise PENDING
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
    predicate ?= emptyFunction.thatReturnsArgument

    @_then promise, (result) ->
      if not predicate result
        throw Error reason
      return result

    return promise

  timeout: (delay, callback) ->

    assertType delay, Number
    assertType callback, Function

    promise = Promise PENDING

    if not @isPending
      immediate this, ->
        promise._inherit @_results, 1
        promise._resolve this
      return promise

    onTimeout = ->
      timeout = null
      try result = callback()
      catch error
        promise._reject error
        return
      promise._fulfill result
      return

    timeout = setTimeout onTimeout, delay

    @_queue.push (parent) ->
      if timeout isnt null
        clearTimeout timeout
        promise._inherit parent._results, 1
        promise._resolve parent
      return

    return promise

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

    if resolver
      return promise._defer resolver

    return {
      promise
      resolve: bind.method promise, "_tryFulfilling"
      reject: bind.method promise, "_reject"
    }

  resolve: (value) ->
    promise = Promise PENDING
    promise._inherit arguments, 1
    promise._tryFulfilling value
    return promise

  reject: (error) ->
    assertType error, Error.Kind
    promise = Promise PENDING
    promise._inherit arguments, 1
    promise._reject error
    return promise

  try: (func) ->
    assertType func, Function
    promise = Promise PENDING
    promise._tryResolving func
    return promise

  delay: (delay) ->
    assertType delay, Number
    promise = Promise PENDING
    fulfill = bind.method promise, "_fulfill"
    setTimeout fulfill, delay
    return promise

  wrap: (func) ->
    assertType func, Function
    return ->
      promise = Promise PENDING
      promise._tryResolving bind.func func, this, arguments
      return promise

  denodeify: (func) ->
    return @ify func

  ify: (func) ->
    assertType func, Function
    return ->
      self = this
      args = arguments

      promise = Promise PENDING
      return promise._defer (resolve, reject) ->

        Array::push.call args, (error, result) ->
          if error then reject error
          else resolve result

        func.apply self, args

  all: (iterable, iterator) ->

    assertType iterator, Function.Maybe

    promise = Promise PENDING

    results =
      if Array.isArray iterable
      then new Array iterable.length
      else if PureObject.test iterable
      then Object.create null
      else {}

    if not hasKeys iterable
      immediate ->
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
      pending =
        if iterator
        then Promise PENDING, key
        else Promise.resolve value, key
      pending.then fulfill, reject
      if iterator
        pending._tryResolving iterator, [value, key]
      return

    return promise

  map: (iterable, iterator) ->
    console.warn "Promise.map() is deprecated! Use Promise.all() instead!"
    @all iterable, iterator

  chain: (iterable, iterator) ->
    assertType iterator, Function
    return sync.reduce iterable, Promise.resolve(), (chain, value, key) ->
      chain.then -> iterator.call null, value, key

  race: (array) ->
    assertType array, Array
    deferred = Promise.defer()
    for promise in array
      if promise and promise.then
        promise.then deferred.resolve, deferred.reject
    return deferred.promise

  onUnhandledRejection: (fallback) ->
    @_rejectFallbacks.push fallback
    return

#
# Internals
#

type.defineValues ->

  _state: PENDING

  _unhandled: yes

  _results: [undefined]

  _queue: []

type.initInstance (result) ->

  if result is PENDING
    @_inherit arguments, 1
    return

  @_defer result
  return

type.defineMethods

  _inherit: (results, offset) ->

    assertType results, Array.or Object

    { length } = results
    return if offset >= length

    index = offset - 1
    @_results.push results[index] while ++index < length
    return

  _resolve: (parent, onFulfilled, onRejected) ->

    assertType parent, Promise
    assertType onFulfilled, Function.Maybe
    assertType onRejected, Function.Maybe

    if parent.isPending
      throw Error "The parent Promise must be resolved!"

    return if not @isPending

    if parent.isFulfilled
      if onFulfilled
        return @_tryResolving onFulfilled, parent._results
      return @_fulfill parent._results[0]

    if onRejected
      return @_tryResolving onRejected, parent._results
    return @_reject parent._results[0]

  _fulfill: (value) ->

    if isType value, Promise
      throw Error "Cannot fulfill with a Promise as the result!"

    return if not @isPending

    @_state = FULFILLED
    @_results[0] = value

    {length} = queue = @_queue
    @_queue = null

    return if not length
    immediate this, ->
      index = -1
      while ++index < length
        queue[index] this
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
        queue[index] this
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
      if value is this
        throw Error "Cannot resolve a Promise with itself!"
      @_tryFulfilling value

  _then: (promise, onFulfilled, onRejected) ->

    assertType promise, Promise
    assertType onFulfilled, Function.Maybe
    assertType onRejected, Function.Maybe

    @_always (parent) ->
      promise._resolve parent, onFulfilled, onRejected
    return

  _always: (onResolved) ->

    assertType onResolved, Function

    @_unhandled = no

    if not @isPending
      return immediate this, ->
        onResolved this

    @_queue.push onResolved
    return

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

  _rejectFallbacks: []

module.exports = Promise = type.build()
