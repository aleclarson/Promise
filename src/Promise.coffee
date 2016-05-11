
require "isNodeJS"

{ Any, isType, assert, assertType } = require "type-utils"

bindMethod = require "bindMethod"
immediate = require "immediate"
Type = require "Type"

QueueItem = require "./QueueItem"

type = Type "Promise"

type.argumentTypes =
  value: Any
  isPending: Boolean.Maybe

type.returnExisting (value) ->
  return value if isType value, Promise

type.defineValues

  _state: 0

  _result: null

  _unhandled: yes if isNodeJS

  _queue: -> []

type.defineProperties

  isFulfilled: get: ->
    @_state > 0

  isRejected: get: ->
    @_state < 0

  isPending: get: ->
    @_state is 0

type.initInstance (value, isPending) ->
  return if isPending
  @_tryFulfilling value

type.defineMethods

  then: (onFulfilled, onRejected) ->
    return this unless @_canResolve onFulfilled, onRejected
    promise = Promise._defer()
    @_unhandled = no if isNodeJS
    if @isPending
      @_queue.push QueueItem this, onFulfilled, onRejected
    else
      resolver = if @isFulfilled then onFulfilled else onRejected
      promise._unwrap resolver, @_result
    return promise

  fail: (onRejected) ->
    @then null, onRejected

  # If the promise is fulfilled or rejected,
  # the opposite handler will never be called.
  _canResolve: (onFulfilled, onRejected) ->
    return no if @isFulfilled and not isType onFulfilled, Function
    return no if @isRejected and not isType onRejected, Function
    return yes

  _fulfill: (value) ->

    return unless @isPending
    @_state = 1
    @_result = value

    if @_queue.length
      for item in @_queue
        item.fulfill value

    @_queue = null
    return

  _reject: (error) ->

    return unless @isPending
    @_state = -1
    @_result = error

    if isNodeJS and @_unhandled
      immediate =>
        return unless @_unhandled
        process.emit "unhandledRejection", error, this

    if @_queue.length
      for item in @_queue
        item.reject error

    @_queue = null
    return

  _tryFulfilling: (value) ->

    # Check for a thenable value.
    result = tryCatch getResolver, value

    if result.error
      @_reject result.error
      return

    resolver = result.value
    if resolver
      @_tryResolving resolver
      return

    @_fulfill value
    return

  _tryResolving: (resolver) ->
    reject = bindMethod this, "_reject"
    resolve = bindMethod this, "_tryFulfilling"
    { error } = tryCatch -> resolver resolve, reject
    reject error if error
    return

  _unwrap: (resolver, value) ->

    immediate =>

      try
        result = resolver value
        assert result isnt promise, "Cannot resolve a Promise with itself!"

      catch error
        @_reject error
        return

      @_tryFulfilling result

type.defineStatics

  isFulfilled: (value) ->
    return no unless isType value, Promise
    return value.isFulfilled

  isRejected: (value) ->
    return yes unless isType value, Promise
    return value.isRejected

  isPending: (value) ->
    return no unless isType value, Promise
    return value.isPending

  resolve: (resolver) ->
    assertType resolver, Function
    promise = Promise._defer()
    promise._tryResolving resolver
    return promise

  reject: (error) ->
    assertType error, Error.Kind
    promise = Promise._defer()
    promise._reject error
    return promise

  try: (resolver) ->
    assertType resolver, Function
    promise = Promise._defer()
    promise._fulfill()
    return promise.then resolver

  # Wraps a function in a 'Promise.try' call.
  wrap: (func) ->
    assertType func, Function
    return ->
      self = this
      args = arguments
      Promise.try ->
        func.apply self, args

  # Converts an (error, result) callback into a Promise.
  ify: (func) ->
    assertType func, Function
    push = Array::push
    return ->
      deferred = Promise._defer()
      push.call args, (error, result) ->
        if error then deferred._reject error
        else deferred._fulfill result
      func.apply this, args
      return deferred

  # Waits for all values to be resolved.
  # Not a single value can be rejected.
  all: (array) ->
    assertType array, Array
    { length } = array
    return Promise.resolve [] unless length
    deferred = Promise._defer()
    reject = bindMethod deferred, "_reject"
    results = new Array length
    resolved = 0
    for value, index in array
      promise = Promise.resolve value
      promise.fail reject
      promise.then (result) ->
        resolved += 1
        results[index] = result
        return if resolved isnt length
        deferred._fulfill results
    return deferred

  # Iterate the (key, value) pairs of an Array or Object
  # and wrap each iteration in a 'Promise.try' call.
  map: (iterable, iterator) ->
    assertType iterable, [ Array, Object, null ]
    assertType iterator, Function
    Promise.all sync.map iterable, (value, key) ->
      Promise.try -> iterator.call null, value, key

  # Create a pending Promise.
  _defer: ->
    Promise undefined, yes

module.exports = Promise = type.build()

#
# Helpers
#

# The function returned here will be
# passed the 'resolve' and 'reject' functions.
getResolver = (value) ->
  resolver = value and value.then
  return unless resolver instanceof Function
  return -> resolver.apply value, arguments

tryCatch = (func, value) ->
  try { value: func value }
  catch error then return { error }
