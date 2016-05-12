
{ Any, isType, assert, assertType } = require "type-utils"

emptyFunction = require "emptyFunction"
bindMethod = require "bindMethod"
immediate = require "immediate"
sync = require "sync"
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

  _unhandled: yes

  _results: -> [ undefined ]

  _queue: -> []

type.definePrototype

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

    unless @_canResolve onFulfilled, onRejected
      return this

    @_unhandled = no

    promise = Promise._defer()

    if @isPending
      @_queue.push QueueItem promise, onFulfilled, onRejected

    else
      resolver = if @isFulfilled then onFulfilled else onRejected
      promise._unwrap resolver, this

    return promise

  fail: (onRejected) ->
    @then null, onRejected

  always: (onResolved) ->

    assertType onResolved, Function

    splice = Array::splice

    onFulfilled = ->
      splice.call arguments, 0, 0, null
      onResolved.apply null, arguments

    onRejected = ->
      splice.call arguments, 1, 0, null
      onResolved.apply null, arguments

    @then onFulfilled, onRejected

  inspect: ->
    value: @_results[0]
    state:
      if @_state > 0 then "fulfilled"
      else if @_state < 0 then "rejected"
      else "pending"

  curry: ->
    for value in arguments
      @_results.push value
    return

  # If the promise is fulfilled or rejected,
  # the opposite handler will never be called.
  _canResolve: (onFulfilled, onRejected) ->
    return no if @isFulfilled and not isType onFulfilled, Function
    return no if @isRejected and not isType onRejected, Function
    return yes

  _fulfill: (value) ->

    return unless @isPending

    assert not isType(value, Promise), "Cannot fulfill with a Promise as the result!"

    @_state = 1
    @_results[0] = value

    if @_queue.length
      for item in @_queue
        item.fulfill this

    @_queue = null
    return

  _reject: (error) ->

    return unless @isPending

    assertType error, Error.Kind

    @_state = -1
    @_results[0] = error

    if @_unhandled then immediate =>
      return unless @_unhandled
      Promise._onUnhandledRejection error, this

    if @_queue.length
      for item in @_queue
        item.reject this

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

    assertType resolver, Function

    reject = bindMethod this, "_reject"
    resolve = bindMethod this, "_tryFulfilling"

    { error } = tryCatch ->
      resolver resolve, reject

    reject error if error
    return

  _unwrap: (resolver, promise) ->

    assertType resolver, Function.Maybe
    assertType promise, Promise
    assert not promise.isPending, "Promise must be resolved before unwrapping!"

    args = promise._results
    length = args.length
    if length > 1
      index = 1
      while index < length
        @_results.push args[index]
        index += 1

    unless resolver
      if promise.isFulfilled
        @_fulfill args[0]
      else @_reject args[0]
      return

    immediate =>

      try
        result = resolver.apply null, args
        assert result isnt this, "Cannot resolve a Promise with itself!"

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
    return Promise [] unless length

    resolved = 0
    results = new Array length

    deferred = Promise._defer()
    reject = bindMethod deferred, "_reject"
    fulfill = (result, index) ->
      resolved += 1
      results[index] = result
      return if resolved isnt length
      deferred._fulfill results

    for value, index in array
      Promise value
        .fail reject
        .curry index
        .then fulfill

    return deferred

  # Iterate the (key, value) pairs of an Array or Object
  # and wrap each iteration in a 'Promise.try' call.
  map: (iterable, iterator) ->
    assertType iterable, [ Array, Object, null ]
    assertType iterator, Function
    Promise.all sync.map iterable, (value, key) ->
      Promise.try -> iterator.call null, value, key

  # Create a pending Promise.
  _defer: -> Promise undefined, yes

  # A hook for handling unhandled rejections.
  _onUnhandledRejection: emptyFunction

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
